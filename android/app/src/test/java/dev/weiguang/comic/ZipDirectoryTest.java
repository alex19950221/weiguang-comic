package dev.weiguang.comic;

import org.junit.*;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.charset.*;
import java.nio.file.Files;
import java.util.*;
import java.util.zip.*;

public class ZipDirectoryTest {
    @Rule public TemporaryFolder temp = new TemporaryFolder();
    private static final byte[] CONTENT = "not a real comic; native decoder fixture".getBytes(StandardCharsets.UTF_8);

    private File make(Charset charset, boolean stored) throws Exception {
        File file = temp.newFile();
        try (ZipOutputStream output = new ZipOutputStream(new FileOutputStream(file), charset)) {
            output.putNextEntry(new ZipEntry("folder/")); output.closeEntry();
            ZipEntry page = new ZipEntry("folder/第02页.png");
            if (stored) {
                CRC32 crc = new CRC32(); crc.update(CONTENT);
                page.setMethod(ZipEntry.STORED); page.setSize(CONTENT.length); page.setCrc(crc.getValue());
            }
            output.putNextEntry(page); output.write(CONTENT); output.closeEntry();
        }
        return file;
    }
    private int central(byte[] data, int number) {
        for (int i = 0; i < data.length - 4; i++)
            if (data[i] == 0x50 && data[i + 1] == 0x4b && data[i + 2] == 1 && data[i + 3] == 2 && number-- == 0) return i;
        throw new AssertionError();
    }
    private File altered(File file, java.util.function.Consumer<byte[]> change) throws Exception {
        byte[] data = Files.readAllBytes(file.toPath()); change.accept(data);
        Files.write(file.toPath(), data); return file;
    }
    @Test public void preservesLegacyNamesAndDirectoryIndexes() throws Exception {
        ZipDirectory archive = new ZipDirectory(make(Charset.forName("GBK"), false));
        assertEquals(2, archive.entries.size());
        assertTrue(archive.entries.get(0).directory);
        assertEquals(1, archive.entries.get(1).index);
        assertArrayEquals("folder/第02页.png".getBytes("GBK"), archive.entries.get(1).name);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        archive.extract(archive.entries.get(1), output, 1024);
        assertArrayEquals(CONTENT, output.toByteArray());
    }
    @Test public void extractsStoredAndDeflatedEntries() throws Exception {
        for (boolean stored : new boolean[] {true, false}) {
            ZipDirectory archive = new ZipDirectory(make(StandardCharsets.UTF_8, stored));
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            archive.extract(archive.entries.get(1), output, 1024);
            assertArrayEquals(CONTENT, output.toByteArray());
        }
    }
    @Test public void rejectsPayloadCorruptionAndDeclaredOversize() throws Exception {
        File file = make(StandardCharsets.UTF_8, true);
        altered(file, data -> data[central(data, 1) + 16] ^= 1);
        ZipDirectory archive = new ZipDirectory(file);
        assertThrows(IOException.class, () -> archive.extract(archive.entries.get(1), new ByteArrayOutputStream(), 1024));
        ZipDirectory good = new ZipDirectory(make(StandardCharsets.UTF_8, true));
        assertThrows(IOException.class, () -> good.extract(good.entries.get(1), new ByteArrayOutputStream(), CONTENT.length - 1));
    }
    @Test public void rejectsLocalNameMismatch() throws Exception {
        ZipDirectory archive = new ZipDirectory(make(StandardCharsets.UTF_8, true));
        try (RandomAccessFile file = new RandomAccessFile(archive.file, "rw")) {
            file.seek(archive.entries.get(1).offset + 30); file.write('X');
        }
        assertThrows(IOException.class, () -> archive.extract(archive.entries.get(1), new ByteArrayOutputStream(), 1024));
    }
    @Test public void encryptedAndSymlinkEntriesAreNeverExtracted() throws Exception {
        File file = make(StandardCharsets.UTF_8, true);
        altered(file, data -> {
            int p = central(data, 1);
            data[p + 5] = 3; data[p + 8] |= 1; data[p + 41] = (byte) 0xa0;
        });
        ZipDirectory archive = new ZipDirectory(file);
        assertTrue(archive.encrypted());
        assertTrue(archive.entries.get(1).symlink);
        assertThrows(IOException.class, () -> archive.extract(archive.entries.get(1), new ByteArrayOutputStream(), 1024));
    }
    @Test public void rejectsTruncationAndDirectoryPointingPastEnd() throws Exception {
        File truncated = make(StandardCharsets.UTF_8, false);
        try (RandomAccessFile file = new RandomAccessFile(truncated, "rw")) { file.setLength(file.length() - 1); }
        assertThrows(IOException.class, () -> new ZipDirectory(truncated));
        File badOffset = make(StandardCharsets.UTF_8, false);
        altered(badOffset, data -> Arrays.fill(data, data.length - 6, data.length - 2, (byte) 0x7f));
        assertThrows(IOException.class, () -> new ZipDirectory(badOffset));
    }
    private static void little(ByteArrayOutputStream out, long value, int count) {
        for (int i = 0; i < count; i++) { out.write((int) value & 255); value >>>= 8; }
    }
    @Test public void readsZip64EndRecordAndEntryExtraFields() throws Exception {
        // A tiny hand-authored ZIP64 archive exercises all sentinel fields without a multi-GB fixture.
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CRC32 crc = new CRC32(); crc.update(CONTENT);
        little(out, 0x04034b50, 4); little(out, 45, 2); little(out, 0, 8);
        little(out, crc.getValue(), 4); little(out, CONTENT.length, 4); little(out, CONTENT.length, 4);
        little(out, 1, 2); little(out, 0, 2); out.write('a'); out.write(CONTENT);
        int directory = out.size();
        little(out, 0x02014b50, 4); little(out, 45, 2); little(out, 45, 2); little(out, 0, 8);
        little(out, crc.getValue(), 4); little(out, 0xffffffffL, 4); little(out, 0xffffffffL, 4);
        little(out, 1, 2); little(out, 28, 2); little(out, 0, 10); little(out, 0xffffffffL, 4); out.write('a');
        little(out, 1, 2); little(out, 24, 2); little(out, CONTENT.length, 8); little(out, CONTENT.length, 8); little(out, 0, 8);
        int directoryBytes = out.size() - directory, end64 = out.size();
        little(out, 0x06064b50, 4); little(out, 44, 8); little(out, 45, 2); little(out, 45, 2);
        little(out, 0, 8); little(out, 1, 8); little(out, 1, 8); little(out, directoryBytes, 8); little(out, directory, 8);
        little(out, 0x07064b50, 4); little(out, 0, 4); little(out, end64, 8); little(out, 1, 4);
        little(out, 0x06054b50, 4); little(out, 0, 4); little(out, 0xffff, 2); little(out, 0xffff, 2);
        little(out, 0xffffffffL, 4); little(out, 0xffffffffL, 4); little(out, 0, 2);
        File file = temp.newFile(); Files.write(file.toPath(), out.toByteArray());
        ZipDirectory archive = new ZipDirectory(file);
        assertEquals(1, archive.entries.size());
        ByteArrayOutputStream decoded = new ByteArrayOutputStream();
        archive.extract(archive.entries.get(0), decoded, 1024);
        assertArrayEquals(CONTENT, decoded.toByteArray());
    }
}
