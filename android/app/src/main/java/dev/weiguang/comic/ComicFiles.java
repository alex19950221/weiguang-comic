package dev.weiguang.comic;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.Locale;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.function.LongConsumer;

/** File-only operations are shared by the bridge and JVM tests. */
final class ComicFiles {
    static String bookId(String value) throws IOException {
        if (value == null || !value.matches("(?i)[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))
            throw new IOException("漫画标识无效。");
        return UUID.fromString(value).toString();
    }

    static String format(String name) throws IOException {
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".cbz") || lower.endsWith(".zip")) return "zip";
        if (lower.endsWith(".pdf")) return "pdf";
        if (lower.endsWith(".epub")) return "epub";
        throw new IOException("请选择 ZIP、CBZ、PDF 或 EPUB 文件。");
    }

    static File resolve(File root, String path) throws IOException {
        if (path == null) throw new IOException("缺少文件路径。");
        File supplied = new File(path);
        // Android legitimately aliases /data/user/0 and /data/data. Canonicalize the
        // trusted directory first, then reject aliases of the selected leaf only.
        File local = new File(root.getCanonicalFile(), supplied.getName());
        String name = local.getName();
        int dot = name.lastIndexOf('.');
        if (dot < 0) throw new IOException("只能读取应用导入的漫画副本。");
        bookId(name.substring(0, dot));
        format(name);
        // Accept an old app-container prefix only when it still names ComicLibrary.
        if ((!supplied.isAbsolute() || !supplied.getParentFile().getName().equals("ComicLibrary")) ||
            !local.getCanonicalFile().equals(local.getAbsoluteFile()) || !local.isFile())
            throw new IOException("只能读取应用导入的漫画副本。");
        return local;
    }

    static long copy(InputStream in, OutputStream out, long expected, BooleanSupplier cancelled,
                     LongConsumer progress) throws IOException {
        byte[] buffer = new byte[65536];
        long count = 0;
        int n;
        while ((n = in.read(buffer)) != -1) {
            if (cancelled.getAsBoolean()) throw new IOException("已取消导入。");
            count += n;
            if (expected > 0 && count > expected) throw new IOException("文件在导入时发生变化，请重试。");
            out.write(buffer, 0, n);
            progress.accept(count);
        }
        if (cancelled.getAsBoolean()) throw new IOException("已取消导入。");
        if (count == 0) throw new IOException("文件大小无效。");
        if (expected > 0 && count != expected) throw new IOException("文件在导入时发生变化，请重试。");
        return count;
    }

    static String fingerprint(File file) throws IOException {
        try (RandomAccessFile in = new RandomAccessFile(file, "r")) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size = in.length();
            if (size == 0) throw new IOException("文件大小无效。");
            digest.update((size + "\n").getBytes(StandardCharsets.UTF_8));
            int count = (int) Math.min(size, 1024 * 1024);
            byte[] bytes = new byte[count];
            in.readFully(bytes);
            digest.update(bytes);
            in.seek(size - count);
            in.readFully(bytes);
            digest.update(bytes);
            StringBuilder result = new StringBuilder(64);
            for (byte b : digest.digest()) result.append(String.format(Locale.ROOT, "%02x", b & 255));
            return result.toString();
        } catch (NoSuchAlgorithmException e) { throw new IOException(e); }
    }

    static int[] dimensions(double width, double height, int maximum) throws IOException {
        if (!(width > 0) || !(height > 0) || !Double.isFinite(width) || !Double.isFinite(height))
            throw new IOException("图片已损坏或格式不受支持。");
        double scale = Math.min(1, Math.min(maximum / Math.max(width, height), Math.sqrt(4_000_000 / (width * height))));
        return new int[] { Math.max(1, (int) Math.floor(width * scale)), Math.max(1, (int) Math.floor(height * scale)) };
    }

    static int naturalCompare(String a, String b) {
        int i = 0, j = 0;
        while (i < a.length() && j < b.length()) {
            char x = a.charAt(i), y = b.charAt(j);
            if (x >= '0' && x <= '9' && y >= '0' && y <= '9') {
                int ai = i, bj = j;
                while (i < a.length() && a.charAt(i) >= '0' && a.charAt(i) <= '9') i++;
                while (j < b.length() && b.charAt(j) >= '0' && b.charAt(j) <= '9') j++;
                while (ai < i - 1 && a.charAt(ai) == '0') ai++;
                while (bj < j - 1 && b.charAt(bj) == '0') bj++;
                if (i - ai != j - bj) return Integer.compare(i - ai, j - bj);
                int n = a.substring(ai, i).compareTo(b.substring(bj, j));
                if (n != 0) return n;
            } else {
                int n = Character.compare(Character.toLowerCase(x), Character.toLowerCase(y));
                if (n != 0) return n;
                i++; j++;
            }
        }
        int n = Integer.compare(a.length() - i, b.length() - j);
        return n != 0 ? n : a.compareTo(b);
    }
}
