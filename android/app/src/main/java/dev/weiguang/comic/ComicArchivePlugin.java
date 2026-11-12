package dev.weiguang.comic;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;

@CapacitorPlugin(name = "ComicArchive")
public class ComicArchivePlugin extends Plugin {
    private interface Operation { JSObject run(ComicStore store) throws Exception; }
    private void perform(PluginCall call, Operation operation) {
        ComicStore.IO.execute(() -> {
            try { call.resolve(operation.run(ComicStore.get(getContext()))); }
            catch (Exception e) { call.reject(e.getMessage() == null ? "无法生成漫画预览。" : e.getMessage()); }
        });
    }

    @PluginMethod public void inspect(PluginCall call) {
        perform(call, store -> store.inspect(call.getString("path")));
    }
    @PluginMethod public void fingerprint(PluginCall call) {
        perform(call, store -> {
            java.io.File file = store.source(call.getString("path"));
            return new JSObject().put("sha256", ComicFiles.fingerprint(file)).put("size", file.length());
        });
    }
    @PluginMethod public void renderPage(PluginCall call) {
        perform(call, store -> {
            // Paid rendering transforms are unavailable until Android has an entitlement provider.
            if (Boolean.TRUE.equals(call.getBoolean("crop", false))) throw new IOException("页面参数无效。");
            JSObject filters = call.getObject("filters");
            if (filters != null && (filters.getInteger("contrast", 100) != 100 ||
                filters.getInteger("sharpness", 0) != 0 || filters.getInteger("warmth", 0) != 0))
                throw new IOException("页面参数无效。");
            return store.render(call.getString("bookId"), call.getString("path"), call.getInt("entry", -1), call.getInt("maxPixel", 2048));
        });
    }
    @PluginMethod public void thumbnail(PluginCall call) {
        perform(call, store -> store.render(call.getString("bookId"), call.getString("path"), call.getInt("entry", -1), 400));
    }
    @PluginMethod public void clearCache(PluginCall call) {
        perform(call, store -> { store.clear(call.getString("bookId")); return new JSObject(); });
    }
    @PluginMethod public void disposeBook(PluginCall call) {
        perform(call, store -> {
            String id = ComicFiles.bookId(call.getString("bookId"));
            if (Boolean.TRUE.equals(call.getBoolean("deleteCopy", false))) store.remove(id);
            else store.clear(id);
            return new JSObject();
        });
    }
}
