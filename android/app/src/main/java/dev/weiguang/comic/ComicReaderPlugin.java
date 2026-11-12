package dev.weiguang.comic;

import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ComicReader")
public class ComicReaderPlugin extends Plugin {
    private boolean fullscreen, awake;
    private void bars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getActivity().getWindow(), getActivity().getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        if (fullscreen) controller.hide(WindowInsetsCompat.Type.systemBars());
        else controller.show(WindowInsetsCompat.Type.systemBars());
    }
    @PluginMethod public void getDisplayState(PluginCall call) {
        getActivity().runOnUiThread(() -> call.resolve(new JSObject().put("fullscreen", fullscreen)));
    }
    @PluginMethod public void setFullscreen(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            fullscreen = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            bars();
            call.resolve(new JSObject().put("fullscreen", fullscreen));
        });
    }
    @PluginMethod public void setKeepAwake(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            awake = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            if (awake) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve(new JSObject().put("enabled", awake));
        });
    }
    @Override protected void handleOnResume() { bars(); }
    @Override protected void handleOnPause() {
        awake = false;
        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    @Override protected void handleOnDestroy() {
        fullscreen = false; awake = false; bars();
        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
