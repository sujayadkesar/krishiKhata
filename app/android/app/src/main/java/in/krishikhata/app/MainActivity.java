package in.krishikhata.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered BEFORE super.onCreate, which is where the bridge
        // is built and the plugin list is read. Registering afterwards leaves
        // the JavaScript side calling a plugin the bridge has never heard of,
        // which fails only when somebody exports a report.
        registerPlugin(PdfPrintPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
