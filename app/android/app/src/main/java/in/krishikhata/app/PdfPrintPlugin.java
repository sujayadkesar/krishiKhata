package in.krishikhata.app;

import android.os.Handler;
import android.os.Looper;
import android.print.PdfWriter;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Printing a report to a PDF through Android's own print framework.
 *
 * window.print() does nothing inside a WebView, so an app that needs a PDF
 * usually ends up drawing one with a JS library — and its Kannada comes out as
 * unshaped glyphs, because those libraries embed the font but place characters
 * left to right. The platform can still PRINT the WebView, and
 * createPrintDocumentAdapter() runs Chromium's real print layout: correct
 * pagination decided by the engine that laid the document out, selectable text,
 * and Kannada shaped exactly as it appears on screen.
 *
 * The document is rendered in an offscreen WebView of its own rather than the
 * app's, so printing never disturbs what the farmer is looking at.
 */
@CapacitorPlugin(name = "PdfPrint")
public class PdfPrintPlugin extends Plugin {

    /** Long enough for a large statement to lay out; short enough not to hang. */
    private static final long RENDER_TIMEOUT_MS = 15_000;

    @PluginMethod
    public void printToFile(final PluginCall call) {
        final String html = call.getString("html");
        final String fileName = call.getString("fileName", "krishi-khata-report.pdf");
        final String jobName = call.getString("jobName", "Krishi Khata report");

        if (html == null || html.isEmpty()) {
            call.reject("No document was supplied.");
            return;
        }

        new Handler(Looper.getMainLooper()).post(() -> render(call, html, fileName, jobName));
    }

    private void render(PluginCall call, String html, String fileName, String jobName) {
        final WebView webView = new WebView(getContext());
        final boolean[] settled = { false };
        final Handler handler = new Handler(Looper.getMainLooper());

        // A document that never finishes loading must not leave the caller
        // waiting forever. Failing after fifteen seconds is recoverable; the
        // JavaScript side falls back and the farmer still sees the report.
        final Runnable timeout = () -> {
            if (settled[0]) return;
            settled[0] = true;
            webView.destroy();
            call.reject("The report took too long to lay out.");
        };
        handler.postDelayed(timeout, RENDER_TIMEOUT_MS);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (settled[0]) return;
                settled[0] = true;
                handler.removeCallbacks(timeout);
                // One frame of grace so embedded fonts finish applying before
                // the print adapter measures the page.
                handler.postDelayed(() -> writePdf(call, view, fileName, jobName), 350);
            }
        });

        // A null base URL keeps the document sandboxed: it is entirely
        // self-contained, so it has no reason to reach the filesystem or network.
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    private void writePdf(PluginCall call, WebView webView, String fileName, String jobName) {
        final PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);

        final PrintAttributes attributes = new PrintAttributes.Builder()
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
            .setResolution(new PrintAttributes.Resolution("pdf", "pdf", 600, 600))
            // The document's own @page rule owns the margins; adding printer
            // margins on top would shrink it a second time.
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .build();

        final File outDir = new File(getContext().getCacheDir(), "reports");
        if (!outDir.exists() && !outDir.mkdirs()) {
            fallbackToPrintDialog(call, adapter, jobName, webView);
            return;
        }
        final File outFile = new File(outDir, safeName(fileName));

        try {
            PdfWriter.write(adapter, attributes, outFile, error -> {
                webView.destroy();
                if (error != null) {
                    fallbackToPrintDialog(call, adapter, jobName, null);
                    return;
                }
                JSObject result = new JSObject();
                result.put("how", "file");
                result.put("uri", contentUri(outFile));
                call.resolve(result);
            });
        } catch (Throwable t) {
            // Some OEM builds refuse a headless print. The system sheet always
            // works, and "Save as PDF" is its first option.
            fallbackToPrintDialog(call, adapter, jobName, webView);
        }
    }

    private void fallbackToPrintDialog(
        PluginCall call,
        PrintDocumentAdapter adapter,
        String jobName,
        WebView webView
    ) {
        try {
            PrintManager printManager =
                (PrintManager) getContext().getSystemService(android.content.Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("Printing is not available on this device.");
                return;
            }
            printManager.print(jobName, adapter, new PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .build());

            JSObject result = new JSObject();
            result.put("how", "dialog");
            call.resolve(result);
        } catch (Throwable t) {
            call.reject("Could not print: " + t.getMessage());
        } finally {
            if (webView != null) webView.destroy();
        }
    }

    private String contentUri(File file) {
        try {
            return FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            ).toString();
        } catch (Throwable t) {
            return file.getAbsolutePath();
        }
    }

    /** Strip anything that would not survive being a filename. */
    private String safeName(String name) {
        String cleaned = name.replaceAll("[^a-zA-Z0-9._-]", "-");
        return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : cleaned + ".pdf";
    }
}
