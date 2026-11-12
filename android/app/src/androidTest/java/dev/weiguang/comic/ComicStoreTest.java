package dev.weiguang.comic;

import android.content.Context;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.media.ExifInterface;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;

/** Runs against the real Android BitmapFactory/PdfRenderer and app-private filesystem. */
@RunWith(AndroidJUnit4.class)
public class ComicStoreTest {
    private ComicStore store;
    private final List<String> ids = new ArrayList<>();
    private File book(String extension) throws Exception {
        String id = UUID.randomUUID().toString(); ids.add(id);
        return new File(store.library, id + "." + extension);
    }
    private String id(File file) { return file.getName().substring(0, 36); }
    @Before public void setup() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        store = ComicStore.get(context);
    }
    @After public void cleanup() throws Exception { for (String id : ids) store.remove(id); }

    private File imageArchive(String extension) throws Exception {
        File file = book(extension);
        try (ZipOutputStream zip = new ZipOutputStream(new FileOutputStream(file))) {
            zip.putNextEntry(new ZipEntry("ComicInfo.xml"));
            zip.write("<ComicInfo><Manga>YesAndRightToLeft</Manga></ComicInfo>".getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
            if (extension.equals("epub")) {
                zip.putNextEntry(new ZipEntry("META-INF/container.xml"));
                zip.write("<container/>".getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
                zip.putNextEntry(new ZipEntry("chapter.xhtml"));
                zip.write("<html><img src='第02页.png'/></html>".getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
            }
            zip.putNextEntry(new ZipEntry("第02页.png"));
            Bitmap bitmap = Bitmap.createBitmap(3000, 4000, Bitmap.Config.ARGB_8888);
            bitmap.eraseColor(Color.WHITE);
            Paint paint = new Paint(); paint.setColor(Color.BLUE);
            new Canvas(bitmap).drawRect(200, 400, 2600, 3500, paint);
            assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, zip));
            bitmap.recycle(); zip.closeEntry();
        }
        assertTrue("Fixture was not written: " + file, file.isFile());
        File mapped = new File(store.library.getCanonicalFile(), file.getName());
        assertTrue("Canonical fixture not found: " + mapped, mapped.isFile());
        assertEquals("Unexpected leaf alias", mapped.getAbsolutePath(), mapped.getCanonicalPath());
        assertEquals("ComicLibrary", file.getParentFile().getName());
        return file;
    }
    @Test public void zipRendersOnlyDownsampledPagesAndRebuildsEvictedCache() throws Exception {
        File source = imageArchive("zip");
        String before = ComicFiles.fingerprint(source);
        JSObject info = store.inspect(source.getPath());
        assertEquals("zip", info.getString("format")); assertEquals("rtl", info.getString("manga"));
        assertEquals(2, info.getJSONArray("entries").length());
        JSObject rendered = store.render(id(source), source.getPath(), 1, 1200);
        assertEquals(900, rendered.getInt("width")); assertEquals(1200, rendered.getInt("height"));
        assertEquals(3000, rendered.getInt("sourceWidth")); assertFalse(rendered.getBoolean("cached"));
        File page = new File(Uri.parse(rendered.getString("url")).getPath());
        assertEquals(store.cache, page.getParentFile()); assertNotEquals(source, page);
        assertTrue(store.render(id(source), source.getPath(), 1, 1200).getBoolean("cached"));
        store.clear(id(source)); assertFalse(page.exists());
        assertFalse(store.render(id(source), source.getPath(), 1, 1200).getBoolean("cached"));
        assertEquals(before, ComicFiles.fingerprint(source));
    }
    @Test public void epubReturnsMetadataAndImageIndexesWithoutReturningOriginalImages() throws Exception {
        File source = imageArchive("epub");
        JSObject info = store.inspect(source.getPath());
        assertEquals("epub", info.getString("format"));
        assertEquals(3, info.getJSONArray("texts").length());
        assertEquals(4, info.getJSONArray("entries").length());
        JSObject rendered = store.render(id(source), source.getPath(), 3, 400);
        assertEquals(300, rendered.getInt("width")); assertEquals(400, rendered.getInt("height"));
    }
    @Test public void pdfUsesNativePageOrderAndRequestedResolution() throws Exception {
        File source = book("pdf");
        PdfDocument pdf = new PdfDocument();
        try {
            for (int i = 0; i < 2; i++) {
                PdfDocument.Page page = pdf.startPage(new PdfDocument.PageInfo.Builder(600, 800, i + 1).create());
                page.getCanvas().drawColor(i == 0 ? Color.WHITE : Color.YELLOW);
                pdf.finishPage(page);
            }
            try (OutputStream out = new FileOutputStream(source)) { pdf.writeTo(out); }
        } finally { pdf.close(); }
        String original = ComicFiles.fingerprint(source);
        assertEquals(2, store.inspect(source.getPath()).getJSONArray("entries").length());
        JSObject rendered = store.render(id(source), source.getPath(), 1, 2048);
        assertEquals(1536, rendered.getInt("width")); assertEquals(2048, rendered.getInt("height"));
        Bitmap page = BitmapFactory.decodeFile(Uri.parse(rendered.getString("url")).getPath());
        assertTrue(Color.red(page.getPixel(10, 10)) > 240); assertTrue(Color.blue(page.getPixel(10, 10)) < 20);
        page.recycle();
        assertEquals(original, ComicFiles.fingerprint(source));
    }
    @Test public void invalidSourcesAndCorruptImagesFailWithoutTouchingOriginal() throws Exception {
        File source = book("zip");
        try (ZipOutputStream zip = new ZipOutputStream(new FileOutputStream(source))) {
            zip.putNextEntry(new ZipEntry("bad.png")); zip.write(new byte[] {1, 2, 3}); zip.closeEntry();
        }
        String original = ComicFiles.fingerprint(source);
        try { store.render(id(source), source.getPath(), 0, 1200); fail(); } catch (IOException expected) { }
        assertEquals(original, ComicFiles.fingerprint(source));
        try { store.inspect("/sdcard/" + source.getName()); fail(); } catch (IOException expected) { }
        try { store.remove("../../"); fail(); } catch (IOException expected) { }
        File[] leftovers = store.cache.listFiles((dir, name) -> name.endsWith(".part"));
        assertNotNull(leftovers); assertEquals(0, leftovers.length);
    }
    @Test public void jpegExifRotationIsAppliedWithoutChangingTheArchive() throws Exception {
        File jpeg = File.createTempFile("orientation-", ".jpg", store.cache);
        File source = book("zip");
        try {
            Bitmap bitmap = Bitmap.createBitmap(120, 80, Bitmap.Config.ARGB_8888);
            bitmap.eraseColor(Color.BLUE);
            try (OutputStream out = new FileOutputStream(jpeg)) { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out); }
            bitmap.recycle();
            ExifInterface exif = new ExifInterface(jpeg.getPath());
            exif.setAttribute(ExifInterface.TAG_ORIENTATION, "6"); exif.saveAttributes();
            try (ZipOutputStream zip = new ZipOutputStream(new FileOutputStream(source)); InputStream input = new FileInputStream(jpeg)) {
                zip.putNextEntry(new ZipEntry("01.jpg"));
                byte[] buffer = new byte[8192]; int n;
                while ((n = input.read(buffer)) != -1) zip.write(buffer, 0, n);
                zip.closeEntry();
            }
            String before = ComicFiles.fingerprint(source);
            JSObject rendered = store.render(id(source), source.getPath(), 0, 2048);
            assertEquals(80, rendered.getInt("sourceWidth")); assertEquals(120, rendered.getInt("sourceHeight"));
            assertEquals(80, rendered.getInt("width")); assertEquals(120, rendered.getInt("height"));
            assertEquals(before, ComicFiles.fingerprint(source));
        } finally { jpeg.delete(); }
    }
}
