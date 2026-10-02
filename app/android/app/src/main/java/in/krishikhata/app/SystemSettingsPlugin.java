package in.krishikhata.app;

import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opening the phone's own backup settings.
 *
 * WHY THIS EXISTS. The app relies on Android Auto Backup, which copies its
 * database to the user's Google account. That only happens if the phone's own
 * "Back up to Google Drive" switch is on — and an app cannot read that switch,
 * cannot turn it on, cannot trigger a backup, and cannot find out when one last
 * ran. BackupManager.isBackupEnabled() is signature-permission only.
 *
 * So the app had been telling farmers their records were safe in their Google
 * account without any way of knowing whether a single byte had ever been
 * copied. The honest alternative is not a better claim, it is a door: send them
 * to the screen where the switch and the account name actually are, and let
 * them look.
 *
 * ACTION_BACKUP_AND_RESET is not in the public SDK and some manufacturers have
 * removed it, hence the ladder down to privacy settings and then to the
 * settings root. resolveActivity is safe for these without a <queries> entry
 * because the settings provider is always visible to every app.
 */
@CapacitorPlugin(name = "SystemSettings")
public class SystemSettingsPlugin extends Plugin {

    private static final String[] CANDIDATES = {
        "android.settings.BACKUP_AND_RESET_SETTINGS",
        Settings.ACTION_PRIVACY_SETTINGS,
        Settings.ACTION_SETTINGS,
    };

    @PluginMethod
    public void openBackupSettings(final PluginCall call) {
        for (String action : CANDIDATES) {
            Intent intent = new Intent(action);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(getContext().getPackageManager()) == null) continue;
            try {
                getContext().startActivity(intent);
                JSObject out = new JSObject();
                out.put("opened", action);
                call.resolve(out);
                return;
            } catch (Exception ignored) {
                // Try the next one down rather than failing on the first
                // manufacturer that has removed a screen.
            }
        }
        call.reject("No settings screen could be opened on this phone.");
    }
}
