package dev.weiguang.comic;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ComicImportPlugin.class);
        registerPlugin(ComicArchivePlugin.class);
        registerPlugin(ComicReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
