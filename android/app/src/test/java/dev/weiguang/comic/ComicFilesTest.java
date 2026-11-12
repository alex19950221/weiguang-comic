package dev.weiguang.comic;

import org.junit.*;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

public class ComicFilesTest {
    @Rule public TemporaryFolder temp = new TemporaryFolder();
    private static final String ID = "01234567-89ab-cdef-0123-456789abcdef";

    @Test public void identityRejectsTraversalAndNonCanonicalForms() throws Exception {
        assertEquals(ID, ComicFiles.bookId(ID.toUpperCase(Locale.ROOT)));
        for (String input : new String[] {"../" + ID, "1-1-1-1-1", "", ID + ".zip"})
            assertThrows(IOException.class, () -> ComicFiles.bookId(input));
    }
    @Test public void sourceResolutionNeverReadsExternalFiles() throws Exception {
        File library = temp.newFolder("ComicLibrary");
        File own = new File(library, ID + ".zip");
        Files.write(own.toPath(), new byte[] {1});
        assertEquals(own, ComicFiles.resolve(library, own.getAbsolutePath()));
        assertEquals(own, ComicFiles.resolve(library, new File(temp.getRoot(), "old/ComicLibrary/" + ID + ".zip").getAbsolutePath()));
        assertThrows(IOException.class, () -> ComicFiles.resolve(library, "/sdcard/" + ID + ".zip"));
        assertThrows(IOException.class, () -> ComicFiles.resolve(library, "/old/ComicLibrary/../../passwd"));
    }
    @Test public void copyDetectsSizeChangesAndCancellation() throws Exception {
        byte[] bytes = new byte[140000];
        AtomicBoolean cancel = new AtomicBoolean();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertThrows(IOException.class, () -> ComicFiles.copy(new ByteArrayInputStream(bytes), output, bytes.length,
            cancel::get, n -> cancel.set(true)));
        assertTrue(output.size() < bytes.length);
        assertThrows(IOException.class, () -> ComicFiles.copy(new ByteArrayInputStream(bytes), new ByteArrayOutputStream(), 1, () -> false, n -> {}));
        assertThrows(IOException.class, () -> ComicFiles.copy(new ByteArrayInputStream(bytes), new ByteArrayOutputStream(), bytes.length + 1, () -> false, n -> {}));
    }
    @Test public void copyPreservesSourceAndReportsExactCount() throws Exception {
        byte[] bytes = "user-owned archive".getBytes(StandardCharsets.UTF_8);
        byte[] original = bytes.clone();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        long[] copied = {0};
        assertEquals(bytes.length, ComicFiles.copy(new ByteArrayInputStream(bytes), output, 0, () -> false, n -> copied[0] = n));
        assertArrayEquals(original, bytes);
        assertArrayEquals(original, output.toByteArray());
        assertEquals(bytes.length, copied[0]);
    }
    @Test public void fingerprintMatchesIosProtocolIncludingOverlappingSamples() throws Exception {
        File file = temp.newFile();
        Files.write(file.toPath(), new byte[] {97, 98, 99});
        assertEquals("1e0ff07aca747fe26f9e2feaf98eef590f2bc17afae5e626e398712920643055", ComicFiles.fingerprint(file));
        assertArrayEquals(new byte[] {97, 98, 99}, Files.readAllBytes(file.toPath()));
    }
    @Test public void naturalSortHandlesVeryLongNumbersWithoutOverflow() {
        List<String> names = new ArrayList<>(Arrays.asList("卷10.cbz", "卷2.cbz", "卷99999999999999999999.cbz", "卷100000000000000000000.cbz", "卷01.cbz"));
        names.sort(ComicFiles::naturalCompare);
        assertEquals(Arrays.asList("卷01.cbz", "卷2.cbz", "卷10.cbz", "卷99999999999999999999.cbz", "卷100000000000000000000.cbz"), names);
    }
    @Test public void downsamplingBoundsLongStripsAndLargeSpreads() throws Exception {
        assertArrayEquals(new int[] {100, 1000}, ComicFiles.dimensions(100, 1000, 2048));
        assertArrayEquals(new int[] {20, 2048}, ComicFiles.dimensions(1000, 100000, 2048));
        int[] spread = ComicFiles.dimensions(10000, 8000, 8192);
        assertTrue((long) spread[0] * spread[1] <= 4000000);
        assertTrue(spread[0] <= 8192);
        assertThrows(IOException.class, () -> ComicFiles.dimensions(-1, 200, 2048));
        assertThrows(IOException.class, () -> ComicFiles.dimensions(Double.POSITIVE_INFINITY, 1, 2048));
    }
}
