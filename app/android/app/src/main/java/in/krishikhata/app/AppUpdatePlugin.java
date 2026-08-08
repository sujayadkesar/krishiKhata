package in.krishikhata.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Updating the app from inside the app.
 *
 * There is no Play Store here. Until now a new version reached a farmer as an
 * APK forwarded on WhatsApp, which is bad in three separate ways: the file is
 * indistinguishable from any other APK somebody might send, it has to be found
 * again in Downloads to install, and WhatsApp re-compresses nothing but
 * happily expires the message.
 *
 * So the app fetches its own update: the release APK is downloaded straight
 * from the GitHub release that CI published, then handed to Android's package
 * installer. It installs OVER the existing app — no uninstall, no data loss —
 * provided both builds are signed with the same key, which is why the release
 * keystore matters more than anything else in the build.
 *
 * Nothing happens silently. Android requires the user to allow this app to
 * install packages, and then to confirm the install itself. Both are the
 * platform's own screens; this plugin only gets the file there and opens them.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final int BUFFER = 32 * 1024;

    /** One thread: two concurrent downloads of the same APK help nobody. */
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    /** Version of the running build, read from the package rather than the bundle. */
    @PluginMethod
    public void currentVersion(PluginCall call) {
        JSObject result = new JSObject();
        try {
            android.content.pm.PackageInfo info = getContext()
                .getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0);
            result.put("version", info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= 28
                ? info.getLongVersionCode()
                : info.versionCode);
        } catch (Exception e) {
            result.put("version", null);
        }
        call.resolve(result);
    }

    /**
     * Whether Android will let this app start an install at all.
     *
     * "Install unknown apps" is per-app and off by default. Checking first is
     * what lets the UI send the farmer to the right settings screen instead of
     * showing them an install that silently does nothing.
     */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            allowed = getContext().getPackageManager().canRequestPackageInstalls();
        }
        result.put("allowed", allowed);
        call.resolve(result);
    }

    /** Open the system screen where that permission is granted. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()))
                : new Intent(Settings.ACTION_SECURITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Throwable t) {
            call.reject("Could not open the settings screen: " + t.getMessage());
        }
    }

    /**
     * Download the APK, reporting progress as it goes.
     *
     * Written to the app's own external files directory, which needs no storage
     * permission and is cleared when the app is uninstalled — an APK left in
     * the public Downloads folder is exactly the litter this feature exists to
     * stop.
     */
    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        final String version = call.getString("version", "latest");
        if (url == null || url.isEmpty()) {
            call.reject("No download address was supplied.");
            return;
        }

        io.execute(() -> {
            HttpURLConnection connection = null;
            try {
                File dir = new File(getContext().getExternalFilesDir(null), "updates");
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("Could not create a place to save the download.");
                    return;
                }

                // Only ever one update file on disk. Keeping every version the
                // farmer has ever downloaded would quietly eat a phone with
                // 8 GB of storage.
                File[] stale = dir.listFiles();
                if (stale != null) for (File f : stale) f.delete();

                File target = new File(dir, "krishi-khata-" + safe(version) + ".apk");

                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(20_000);
                connection.setReadTimeout(60_000);
                // GitHub redirects release assets to its object storage.
                connection.setInstanceFollowRedirects(true);
                connection.connect();

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject("The download failed (HTTP " + status + ").");
                    return;
                }

                long total = connection.getContentLengthLong();
                long done = 0;
                int lastPercent = -1;

                try (InputStream in = connection.getInputStream();
                     FileOutputStream out = new FileOutputStream(target)) {
                    byte[] buffer = new byte[BUFFER];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        done += read;

                        // Only on a whole-percent change: a progress event per
                        // 32 KB chunk floods the bridge and makes the bar
                        // stutter rather than move.
                        int percent = total > 0 ? (int) (done * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("bytes", done);
                            progress.put("total", total);
                            notifyListeners("progress", progress);
                        }
                    }
                    out.flush();
                }

                if (target.length() <= 0) {
                    call.reject("The download arrived empty. Check the connection and try again.");
                    return;
                }

                JSObject result = new JSObject();
                result.put("path", target.getAbsolutePath());
                result.put("bytes", target.length());
                call.resolve(result);
            } catch (Throwable t) {
                call.reject("Could not download the update: " + t.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    /**
     * Hand the downloaded file to Android's package installer.
     *
     * A content:// URI through FileProvider, never a file:// path — passing a
     * file URI to another app has thrown FileUriExposedException since Android
     * 7, and the installer is very much another app.
     */
    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("No downloaded file to install.");
            return;
        }

        File file = new File(path);
        if (!file.exists()) {
            call.reject("The downloaded file is no longer there. Download it again.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("permission-required");
            return;
        }

        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            call.resolve();
        } catch (Throwable t) {
            call.reject("Could not start the install: " + t.getMessage());
        }
    }

    private String safe(String s) {
        return s.replaceAll("[^a-zA-Z0-9._-]", "-");
    }
}
