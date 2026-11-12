package dev.weiguang.comic;

import java.io.*;
import java.util.*;
import java.util.zip.*;

/** Central-directory indexes stay identical to iOS, including non-image entries. */
final class ZipDirectory {
    static final long MAX_IMAGE = 256L * 1024 * 1024;

    static final class Entry {
        int index, flags, method;
        byte[] name;
        long size, compressed, offset, crc;
        boolean directory, symlink;
    }

    final File file;
    final List<Entry> entries = new ArrayList<>();
    final long directoryOffset;

    ZipDirectory(File file) throws IOException {
        this.file = file;
        try (RandomAccessFile in = new RandomAccessFile(file, "r")) {
            long length = in.length();
            if (length < 22) throw invalid();
            long tailStart = Math.max(0, length - 65557);
            byte[] tail = read(in, tailStart, (int) (length - tailStart));
            int end = -1;
            for (int p = tail.length - 22; p >= 0; p--) {
                if (u32(tail, p) == 0x06054b50L && p + 22 + u16(tail, p + 20) == tail.length) {
                    end = p;
                    break;
                }
            }
            if (end < 0 || u16(tail, end + 4) != 0 || u16(tail, end + 6) != 0 ||
                u16(tail, end + 8) != u16(tail, end + 10)) throw invalid();
            long count = u16(tail, end + 10);
            long bytes = u32(tail, end + 12);
            long offset = u32(tail, end + 16);
            long limit = tailStart + end;
            if (count == 0xffff || bytes == 0xffffffffL || offset == 0xffffffffL) {
                if (limit < 20) throw invalid();
                byte[] loc = read(in, limit - 20, 20);
                if (u32(loc, 0) != 0x07064b50L || u32(loc, 4) != 0 || u32(loc, 16) != 1) throw invalid();
                long at = u64(loc, 8);
                if (at > limit - 76) throw invalid();
                byte[] rec = read(in, at, 56);
                if (u32(rec, 0) != 0x06064b50L || u64(rec, 4) < 44 ||
                    u64(rec, 4) > limit - at - 32 || u32(rec, 16) != 0 ||
                    u32(rec, 20) != 0 || u64(rec, 24) != u64(rec, 32)) throw invalid();
                count = u64(rec, 32);
                bytes = u64(rec, 40);
                offset = u64(rec, 48);
                limit = at;
            }
            if (count > 100000 || offset > limit || bytes > limit - offset || count > bytes / 46) throw invalid();
            directoryOffset = offset;
            long cursor = offset;
            long directoryEnd = offset + bytes;
            int names = 0;
            for (int i = 0; i < count; i++) {
                if (cursor > directoryEnd - 46) throw invalid();
                byte[] h = read(in, cursor, 46);
                int nameLength = u16(h, 28), extraLength = u16(h, 30);
                int recordSize = 46 + nameLength + extraLength + u16(h, 32);
                names += nameLength;
                if (u32(h, 0) != 0x02014b50L || recordSize > directoryEnd - cursor ||
                    names > 16 * 1024 * 1024 || u16(h, 34) != 0) throw invalid();
                Entry e = new Entry();
                e.index = i;
                e.name = read(in, cursor + 46, nameLength);
                e.flags = u16(h, 8);
                e.method = u16(h, 10);
                e.crc = u32(h, 16);
                e.compressed = u32(h, 20);
                e.size = u32(h, 24);
                e.offset = u32(h, 42);
                if (e.size == 0xffffffffL || e.compressed == 0xffffffffL || e.offset == 0xffffffffL) {
                    byte[] extra = read(in, cursor + 46 + nameLength, extraLength);
                    boolean found = false;
                    for (int p = 0; p + 4 <= extra.length;) {
                        int size = u16(extra, p + 2);
                        if (size > extra.length - p - 4) throw invalid();
                        if (u16(extra, p) == 1) {
                            int q = p + 4, stop = q + size;
                            if (e.size == 0xffffffffL) { if (q + 8 > stop) throw invalid(); e.size = u64(extra, q); q += 8; }
                            if (e.compressed == 0xffffffffL) { if (q + 8 > stop) throw invalid(); e.compressed = u64(extra, q); q += 8; }
                            if (e.offset == 0xffffffffL) { if (q + 8 > stop) throw invalid(); e.offset = u64(extra, q); }
                            found = true;
                            break;
                        }
                        p += size + 4;
                    }
                    if (!found) throw invalid();
                }
                int platform = u16(h, 4) >> 8;
                long mode = u32(h, 38) >> 16;
                boolean unix = platform == 3 || platform == 19;
                e.directory = (nameLength > 0 && e.name[nameLength - 1] == '/') || (unix && (mode & 0xf000) == 0x4000);
                e.symlink = unix && (mode & 0xf000) == 0xa000;
                if (e.offset >= offset) throw invalid();
                entries.add(e);
                cursor += recordSize;
            }
        }
    }

    boolean encrypted() {
        for (Entry e : entries) if ((e.flags & 0x41) != 0) return true;
        return false;
    }

    void extract(Entry e, OutputStream output, long maximum) throws IOException {
        if (e.directory || e.symlink || (e.flags & 0x41) != 0 || e.size > maximum ||
            (e.method != 0 && e.method != 8)) throw invalid();
        try (RandomAccessFile in = new RandomAccessFile(file, "r")) {
            if (e.offset > directoryOffset - 30) throw invalid();
            byte[] h = read(in, e.offset, 30);
            if (u32(h, 0) != 0x04034b50L || u16(h, 8) != e.method ||
                (u16(h, 6) & 0x41) != 0 || u16(h, 26) != e.name.length) throw invalid();
            if (!Arrays.equals(read(in, e.offset + 30, e.name.length), e.name)) throw invalid();
            long start = e.offset + 30 + u16(h, 26) + u16(h, 28);
            if (start > directoryOffset || e.compressed > directoryOffset - start) throw invalid();
            in.seek(start);
            InputStream bounded = new InputStream() {
                long remaining = e.compressed;
                @Override public int read() throws IOException {
                    if (remaining == 0) return -1;
                    int value = in.read();
                    if (value < 0) throw new EOFException();
                    remaining--;
                    return value;
                }
                @Override public int read(byte[] b, int off, int len) throws IOException {
                    if (len == 0) return 0;
                    if (remaining == 0) return -1;
                    int n = in.read(b, off, (int) Math.min(len, remaining));
                    if (n < 0) throw new EOFException();
                    remaining -= n;
                    return n;
                }
            };
            Inflater inflater = new Inflater(true);
            try (InputStream stream = e.method == 8 ? new InflaterInputStream(bounded, inflater) : bounded) {
                CRC32 crc = new CRC32();
                long count = 0;
                byte[] buffer = new byte[65536];
                int n;
                while ((n = stream.read(buffer)) != -1) {
                    count += n;
                    if (count > e.size || count > maximum) throw invalid();
                    output.write(buffer, 0, n);
                    crc.update(buffer, 0, n);
                }
                if (count != e.size || crc.getValue() != e.crc) throw new IOException("图片校验失败，文件可能已损坏。");
            } finally { inflater.end(); }
        }
    }

    private static IOException invalid() { return new IOException("不是有效的 ZIP 文件。"); }
    private static byte[] read(RandomAccessFile in, long offset, int count) throws IOException {
        if (offset < 0 || offset > in.length() || count > in.length() - offset) throw invalid();
        byte[] data = new byte[count];
        in.seek(offset);
        in.readFully(data);
        return data;
    }
    private static int u16(byte[] b, int p) { return (b[p] & 255) | (b[p + 1] & 255) << 8; }
    private static long u32(byte[] b, int p) { return (long) u16(b, p) | (long) u16(b, p + 2) << 16; }
    private static long u64(byte[] b, int p) throws IOException {
        long high = u32(b, p + 4);
        if (high > 0x7fffffffL) throw invalid();
        return u32(b, p) | high << 32;
    }
}
