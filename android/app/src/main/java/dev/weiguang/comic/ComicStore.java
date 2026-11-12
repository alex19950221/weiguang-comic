package dev.weiguang.comic;

import android.content.Context;
import android.graphics.*;
import android.graphics.pdf.PdfRenderer;
import android.media.ExifInterface;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.*;
import java.nio.charset.*;
import java.util.*;
import java.util.concurrent.*;

final class ComicStore {
    // A single queue bounds native decoding memory and serializes cache removal with rendering.
    static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static ComicStore instance;
    final File library, cache;
    private final LinkedHashMap<String, ZipDirectory> directories = new LinkedHashMap<>(8, .75f, true);
    private static final long CACHE_LIMIT = 500L * 1024 * 1024;

    static synchronized ComicStore get(Context context) throws IOException {
        if (instance == null) instance = new ComicStore(context.getApplicationContext());
        return instance;
    }

    private ComicStore(Context context) throws IOException {
        library = new File(context.getNoBackupFilesDir(), "ComicLibrary");
        cache = new File(context.getCacheDir(), "ComicPages");
        if ((!library.isDirectory() && !library.mkdirs()) || (!cache.isDirectory() && !cache.mkdirs()))
            throw new IOException("页面缓存写入失败，请检查可用空间。");
        // Interrupted copies are never visible to the library database.
        File[] pending = library.listFiles((dir, name) -> name.endsWith(".part"));
        if (pending != null) for (File file : pending) file.delete();
        File[] temporary = cache.listFiles((dir, name) -> name.endsWith(".part"));
        if (temporary != null) for (File file : temporary) file.delete();
    }

    File source(String path) throws IOException { return ComicFiles.resolve(library, path); }

    private ZipDirectory zip(File file) throws IOException {
        String key = file.getAbsolutePath();
        ZipDirectory result = directories.get(key);
        if (result == null) {
            result = new ZipDirectory(file);
            directories.put(key, result);
            if (directories.size() > 4) directories.remove(directories.keySet().iterator().next());
        }
        return result;
    }

    JSObject inspect(String path) throws IOException {
        File file = source(path);
        String format = ComicFiles.format(file.getName());
        JSArray entries = new JSArray();
        JSObject result = new JSObject().put("format", format).put("encrypted", false).put("entries", entries);
        if (format.equals("pdf")) {
            try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
                 PdfRenderer pdf = new PdfRenderer(fd)) {
                for (int i = 0; i < pdf.getPageCount(); i++)
                    entries.put(new JSObject().put("index", i).put("name", String.format(Locale.ROOT, "%06d.png", i + 1)).put("size", 0));
            } catch (SecurityException e) { throw new IOException("暂不支持需要密码的 PDF，请选择未加密的自有文件。"); }
            catch (IllegalArgumentException e) { throw new IOException("PDF 已损坏或格式不受支持。"); }
            return result;
        }
        ZipDirectory archive = zip(file);
        boolean encrypted = archive.encrypted();
        result.put("encrypted", encrypted);
        JSArray texts = new JSArray();
        long textBytes = 0;
        for (ZipDirectory.Entry entry : archive.entries) {
            JSObject item = new JSObject().put("index", entry.index).put("size", entry.size)
                .put("isDirectory", entry.directory).put("isSymlink", entry.symlink);
            String name = null;
            if ((entry.flags & 0x800) != 0) {
                try { name = StandardCharsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(entry.name)).toString(); }
                catch (CharacterCodingException ignored) { /* Web layer tries legacy filename encodings. */ }
            }
            if (name != null) item.put("name", name);
            else item.put("rawName", Base64.encodeToString(entry.name, Base64.NO_WRAP));
            entries.put(item);
            if (encrypted || entry.directory || entry.symlink) continue;
            String asciiName = new String(entry.name, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            boolean comicInfo = asciiName.equals("comicinfo.xml");
            boolean document = format.equals("epub") && asciiName.matches(".*\\.(xml|opf|xhtml|html|htm|svg)$");
            if (!comicInfo && !document) continue;
            if (entry.size > 1024 * 1024 || (textBytes += entry.size) > 16 * 1024 * 1024)
                throw new IOException("EPUB 文档大小异常。");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            archive.extract(entry, output, 1024 * 1024);
            String text = output.toString(StandardCharsets.UTF_8.name());
            if (document) texts.put(new JSObject().put("index", entry.index).put("text", text));
            if (comicInfo && text.replaceAll("(?s)<!--.*?-->", "")
                .matches("(?is).*<Manga>\\s*(YesAndRightToLeft|Yes)\\s*</Manga>.*")) result.put("manga", "rtl");
        }
        if (format.equals("epub")) result.put("texts", texts);
        return result;
    }

    JSObject render(String bookId, String path, int index, int maximum) throws IOException {
        String id = ComicFiles.bookId(bookId);
        File source = source(path);
        if (index < 0 || maximum < 1 || maximum > 8192) throw new IOException("页面参数无效。");
        // Size is included to avoid reusing a preview after reimporting a changed source.
        String key = id + "-" + index + "-" + maximum + "-" + source.length();
        File image = new File(cache, key + ".jpg");
        File metadata = new File(cache, key + ".meta");
        if (image.isFile() && metadata.isFile()) {
            try (DataInputStream input = new DataInputStream(new FileInputStream(metadata))) {
                int w = input.readInt(), h = input.readInt(), sw = input.readInt(), sh = input.readInt();
                image.setLastModified(System.currentTimeMillis());
                return rendered(image, w, h, sw, sh, true);
            } catch (IOException ignored) { image.delete(); metadata.delete(); }
        }
        Bitmap bitmap = null;
        File scratch = null;
        File partial = new File(cache, key + ".part");
        int sourceWidth, sourceHeight;
        try {
            if (ComicFiles.format(source.getName()).equals("pdf")) {
                try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY);
                     PdfRenderer pdf = new PdfRenderer(fd)) {
                    if (index >= pdf.getPageCount()) throw new IOException("漫画页不存在。");
                    try (PdfRenderer.Page page = pdf.openPage(index)) {
                        sourceWidth = page.getWidth(); sourceHeight = page.getHeight();
                        double scale = maximum / (double) Math.max(sourceWidth, sourceHeight);
                        int[] size = ComicFiles.dimensions(sourceWidth * scale, sourceHeight * scale, maximum);
                        bitmap = Bitmap.createBitmap(size[0], size[1], Bitmap.Config.ARGB_8888);
                        bitmap.eraseColor(Color.WHITE);
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    }
                } catch (SecurityException e) { throw new IOException("暂不支持需要密码的 PDF，请选择未加密的自有文件。"); }
            } else {
                ZipDirectory archive = zip(source);
                if (index >= archive.entries.size()) throw new IOException("漫画页不存在。");
                ZipDirectory.Entry entry = archive.entries.get(index);
                if (entry.size > ZipDirectory.MAX_IMAGE) throw new IOException("单张图片超过 256 MB，暂不支持。");
                scratch = File.createTempFile("decode-", ".part", cache);
                try (OutputStream out = new FileOutputStream(scratch)) { archive.extract(entry, out, ZipDirectory.MAX_IMAGE); }
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(scratch.getPath(), bounds);
                int orientation = 1;
                try { orientation = new ExifInterface(scratch.getPath()).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1); }
                catch (IOException ignored) { /* Formats without EXIF keep their stored orientation. */ }
                boolean swap = orientation >= 5 && orientation <= 8;
                sourceWidth = swap ? bounds.outHeight : bounds.outWidth;
                sourceHeight = swap ? bounds.outWidth : bounds.outHeight;
                int[] size = ComicFiles.dimensions(sourceWidth, sourceHeight, maximum);
                int sample = 1;
                while ((long) Math.ceil(sourceWidth / (double) sample) * Math.ceil(sourceHeight / (double) sample) > 8_000_000 ||
                       (sample <= 32768 && sourceWidth / (sample * 2) >= size[0] && sourceHeight / (sample * 2) >= size[1])) sample *= 2;
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = sample;
                options.inPreferredConfig = Bitmap.Config.ARGB_8888;
                bitmap = BitmapFactory.decodeFile(scratch.getPath(), options);
                if (bitmap == null) throw new IOException("图片已损坏或格式不受支持。");
                Matrix transform = new Matrix();
                switch (orientation) {
                    case 2: transform.setScale(-1, 1); break;
                    case 3: transform.setRotate(180); break;
                    case 4: transform.setScale(1, -1); break;
                    case 5: transform.setRotate(90); transform.postScale(-1, 1); break;
                    case 6: transform.setRotate(90); break;
                    case 7: transform.setRotate(270); transform.postScale(-1, 1); break;
                    case 8: transform.setRotate(270); break;
                    default: break;
                }
                if (!transform.isIdentity()) {
                    Bitmap upright = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), transform, true);
                    if (upright != bitmap) { bitmap.recycle(); bitmap = upright; }
                }
                Bitmap scaled = Bitmap.createScaledBitmap(bitmap, size[0], size[1], true);
                if (scaled != bitmap) { bitmap.recycle(); bitmap = scaled; }
            }
            if (bitmap.hasAlpha()) {
                Bitmap opaque = Bitmap.createBitmap(bitmap.getWidth(), bitmap.getHeight(), Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(opaque);
                canvas.drawColor(Color.WHITE);
                canvas.drawBitmap(bitmap, 0, 0, null);
                bitmap.recycle(); bitmap = opaque;
            }
            try (FileOutputStream out = new FileOutputStream(partial)) {
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)) throw new IOException("无法生成漫画预览。");
            }
            if (!partial.renameTo(image)) throw new IOException("页面缓存写入失败，请检查可用空间。");
            try (DataOutputStream out = new DataOutputStream(new FileOutputStream(metadata))) {
                out.writeInt(bitmap.getWidth()); out.writeInt(bitmap.getHeight());
                out.writeInt(sourceWidth); out.writeInt(sourceHeight);
            }
            trim(image);
            return rendered(image, bitmap.getWidth(), bitmap.getHeight(), sourceWidth, sourceHeight, false);
        } catch (OutOfMemoryError e) { throw new IOException("无法生成漫画预览。"); }
        catch (IllegalArgumentException e) { throw new IOException("图片已损坏或格式不受支持。"); }
        finally {
            if (bitmap != null) bitmap.recycle();
            if (scratch != null) scratch.delete();
            partial.delete();
        }
    }

    private JSObject rendered(File file, int w, int h, int sw, int sh, boolean cached) {
        return new JSObject().put("url", android.net.Uri.fromFile(file).toString()).put("width", w).put("height", h)
            .put("sourceWidth", sw).put("sourceHeight", sh).put("cached", cached);
    }

    void clear(String bookId) throws IOException {
        String prefix = bookId == null ? "" : ComicFiles.bookId(bookId) + "-";
        File[] files = cache.listFiles((dir, name) -> name.startsWith(prefix));
        if (files != null) for (File file : files) if (file.isFile() && !file.delete()) throw new IOException("清理参数无效。");
        directories.clear();
    }

    void remove(String bookId) throws IOException {
        String id = ComicFiles.bookId(bookId);
        clear(id);
        for (String suffix : new String[] {".zip", ".pdf", ".epub", ".part"}) {
            File file = new File(library, id + suffix);
            if (file.exists() && !file.delete()) throw new IOException("只能删除应用内的漫画副本。");
        }
    }

    private void trim(File keep) {
        File[] images = cache.listFiles((dir, name) -> name.endsWith(".jpg"));
        if (images == null) return;
        long total = 0;
        for (File image : images) total += image.length();
        Arrays.sort(images, Comparator.comparingLong(File::lastModified));
        for (File image : images) {
            if (total <= CACHE_LIMIT) break;
            if (image.equals(keep)) continue;
            long length = image.length();
            if (image.delete()) {
                total -= length;
                new File(cache, image.getName().replace(".jpg", ".meta")).delete();
            }
        }
    }
}
