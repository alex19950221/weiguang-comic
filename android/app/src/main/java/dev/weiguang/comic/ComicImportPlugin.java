package dev.weiguang.comic;

import android.app.Activity;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "ComicImport")
public class ComicImportPlugin extends Plugin {
    private static final class Source {
        final Uri uri;
        final String token, name;
        final long size;
        Source(Uri uri, String name, long size) {
            this.uri = uri; this.name = name; this.size = size;
            token = "comic-source:" + UUID.randomUUID();
        }
        JSObject json() {
            return new JSObject().put("uri", token).put("name", name).put("size", size).put("isDirectory", false);
        }
    }
    private final Map<String, Source> sources = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> jobs = new ConcurrentHashMap<>();
    private volatile boolean picking;

    @PluginMethod public void pickFiles(PluginCall call) {
        if (picking) { call.reject("文件选择器已打开。"); return; }
        picking = true;
        // Provider MIME labels for CBZ/EPUB are inconsistent; validate the selected name ourselves.
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*")
            .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivityForResult(call, intent, "picked"); }
        catch (RuntimeException e) { picking = false; call.reject("文件选择器暂不可用。"); }
    }

    @ActivityCallback private void picked(PluginCall call, ActivityResult result) {
        picking = false;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("items", new JSArray()));
            return;
        }
        Intent data = result.getData();
        LinkedHashSet<Uri> selected = new LinkedHashSet<>();
        if (data.getClipData() != null) {
            for (int i = 0; i < data.getClipData().getItemCount(); i++) selected.add(data.getClipData().getItemAt(i).getUri());
        } else if (data.getData() != null) selected.add(data.getData());
        ComicStore.IO.execute(() -> {
            List<Source> batch = new ArrayList<>();
            try {
                for (Uri uri : selected) {
                    if (!"content".equals(uri.getScheme())) throw new IOException("文件选择授权已失效，请重新选择文件。");
                    String name = null;
                    long size = 0;
                    try (Cursor cursor = getContext().getContentResolver().query(uri,
                        new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
                        if (cursor != null && cursor.moveToFirst()) {
                            int nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                            int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);
                            if (nameColumn >= 0) name = cursor.getString(nameColumn);
                            if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) size = Math.max(0, cursor.getLong(sizeColumn));
                        }
                    }
                    if (name == null) throw new IOException("文件选择授权已失效，请重新选择文件。");
                    // Unsupported selections are passed to the web queue for a visible per-file error.
                    batch.add(new Source(uri, name, size));
                }
                batch.sort((a, b) -> ComicFiles.naturalCompare(a.name, b.name));
                JSArray items = new JSArray();
                for (Source source : batch) { sources.put(source.token, source); items.put(source.json()); }
                call.resolve(new JSObject().put("items", items));
            } catch (Exception e) { call.reject("文件选择授权已失效，请重新选择文件。"); }
        });
    }

    @PluginMethod public void copyToLibrary(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null) { call.reject("漫画标识无效。"); return; }
        AtomicBoolean cancelled = new AtomicBoolean();
        if (jobs.putIfAbsent(jobId, cancelled) != null) { call.reject("这个文件正在导入。"); return; }
        ComicStore.IO.execute(() -> {
            File partial = null;
            try {
                ComicStore store = ComicStore.get(getContext());
                String id = ComicFiles.bookId(call.getString("bookId"));
                JSObject item = call.getObject("item");
                Source source = item == null ? null : sources.get(item.getString("uri"));
                if (source == null) throw new IOException("文件选择授权已失效，请重新选择文件。");
                String format = ComicFiles.format(source.name);
                File target = new File(store.library, id + "." + format);
                for (String suffix : new String[] {".zip", ".pdf", ".epub"})
                    if (new File(store.library, id + suffix).exists()) throw new IOException("漫画副本已经存在。");
                partial = new File(store.library, id + ".part");
                if (!partial.createNewFile()) throw new IOException("这个文件正在导入。");
                long[] last = {0};
                long size;
                try (InputStream input = getContext().getContentResolver().openInputStream(source.uri);
                     FileOutputStream output = new FileOutputStream(partial)) {
                    if (input == null) throw new IOException("文件选择授权已失效，请重新选择文件。");
                    size = ComicFiles.copy(input, output, source.size, cancelled::get, copied -> {
                        long now = android.os.SystemClock.elapsedRealtime();
                        if (now - last[0] >= 100) { last[0] = now; progress(jobId, copied, source.size); }
                    });
                    output.getFD().sync();
                }
                if (cancelled.get()) throw new IOException("已取消导入。");
                if (!partial.renameTo(target)) throw new IOException("页面缓存写入失败，请检查可用空间。");
                progress(jobId, size, size);
                call.resolve(new JSObject().put("path", target.getAbsolutePath()).put("size", size));
            } catch (SecurityException e) { call.reject("文件选择授权已失效，请重新选择文件。"); }
            catch (Exception e) { call.reject(e.getMessage() == null ? "文件选择授权已失效，请重新选择文件。" : e.getMessage()); }
            finally { if (partial != null) partial.delete(); jobs.remove(jobId); }
        });
    }

    private void progress(String jobId, long copied, long total) {
        notifyListeners("progress", new JSObject().put("jobId", jobId).put("copied", copied).put("total", total));
    }
    @PluginMethod public void cancel(PluginCall call) {
        String jobId = call.getString("jobId");
        AtomicBoolean job = jobId == null ? null : jobs.get(jobId);
        if (job != null) job.set(true);
        call.resolve();
    }
    @PluginMethod public void releaseSources(PluginCall call) {
        JSArray uris = call.getArray("uris", new JSArray());
        for (int i = 0; i < uris.length(); i++) sources.remove(uris.optString(i));
        call.resolve();
    }
    @PluginMethod public void removeCopy(PluginCall call) {
        ComicStore.IO.execute(() -> {
            try { ComicStore.get(getContext()).remove(call.getString("bookId")); call.resolve(); }
            catch (IOException e) { call.reject(e.getMessage()); }
        });
    }
    @PluginMethod public void linkToLibrary(PluginCall call) {
        call.unavailable("原位阅读尚未在安卓提供。");
    }
    @Override protected void handleOnDestroy() {
        for (AtomicBoolean job : jobs.values()) job.set(true);
        sources.clear();
    }
}
