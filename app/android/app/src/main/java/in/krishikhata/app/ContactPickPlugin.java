package in.krishikhata.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Getting a worker's name and number out of the phone book.
 *
 * TWO ROUTES, AND THE CHEAP ONE IS THE DEFAULT.
 *
 * `pick` opens the system's own contact picker. It needs NO permission at all:
 * the picker runs in the system's process with the system's own search, and
 * hands back a URI the app has one-shot read access to. The address book is
 * never readable by this app — only the one row the farmer chose, once.
 *
 * `listContacts` reads the phone book into the app so it can be searched and
 * several workers added at a sitting, which is what signing on a crew actually
 * looks like. That genuinely needs READ_CONTACTS, so it is asked for only when
 * the farmer taps that option, and refusing it falls back to `pick` rather
 * than dead-ending.
 *
 * READ ONLY. The obvious off-the-shelf plugin bundles READ_CONTACTS and
 * WRITE_CONTACTS into one alias and will not proceed until both are granted —
 * so a farm ledger would be asking for the right to modify the address book,
 * and the Play listing would say so. Nothing here ever writes a contact.
 *
 * Picking on CommonDataKinds.Phone rather than Contacts matters either way: it
 * lists numbers instead of people, so somebody with three numbers is three
 * rows and the farmer chooses which, rather than the app guessing.
 */
@CapacitorPlugin(
    name = "ContactPick",
    permissions = { @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts") }
)
public class ContactPickPlugin extends Plugin {

    /** Enough for any farm's address book; a guard against a pathological one. */
    private static final int MAX_CONTACTS = 2000;

    /* ---------------------------------------------------------- permission - */

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", getPermissionState("contacts") == PermissionState.GRANTED);
        call.resolve(out);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            JSObject out = new JSObject();
            out.put("granted", true);
            call.resolve(out);
            return;
        }
        requestPermissionForAlias("contacts", call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", getPermissionState("contacts") == PermissionState.GRANTED);
        call.resolve(out);
    }

    /* ------------------------------------------------------------- listing - */

    @PluginMethod
    public void listContacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            call.reject("Permission to read contacts was not granted.", "DENIED");
            return;
        }

        String[] columns = {
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
        };

        // Keyed by name+number so one person saved twice with the same number
        // is one row. LinkedHashMap to keep the provider's alphabetical order.
        Map<String, JSObject> seen = new LinkedHashMap<>();

        try (Cursor cursor = getContext().getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                columns, null, null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " COLLATE NOCASE ASC")) {

            if (cursor != null) {
                while (cursor.moveToNext() && seen.size() < MAX_CONTACTS) {
                    String name = cursor.getString(0);
                    String number = cursor.getString(1);
                    if (name == null || number == null) continue;

                    String digits = number.replaceAll("[^0-9]", "");
                    if (digits.isEmpty()) continue;

                    String key = name.trim() + "|" + digits;
                    if (seen.containsKey(key)) continue;

                    JSObject row = new JSObject();
                    row.put("name", name.trim());
                    row.put("phone", number.trim());
                    seen.put(key, row);
                }
            }

            JSArray out = new JSArray();
            for (JSObject row : seen.values()) out.put(row);

            JSObject result = new JSObject();
            result.put("contacts", out);
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Permission to read contacts was not granted.", "DENIED", e);
        } catch (Exception e) {
            call.reject("The phone book could not be read.", e);
        }
    }

    /* -------------------------------------------------------- system pick - */

    @PluginMethod
    public void pick(final PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
            startActivityForResult(call, intent, "picked");
        } catch (Exception e) {
            call.reject("No contacts app available.", e);
        }
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;

        // Backing out of the picker is an ordinary thing to do, not a failure.
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            resolveCancelled(call);
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            resolveCancelled(call);
            return;
        }

        String[] columns = {
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
        };

        try (Cursor cursor = getContext().getContentResolver().query(uri, columns, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) {
                call.reject("Could not read the contact that was picked.");
                return;
            }

            JSObject out = new JSObject();
            out.put("cancelled", false);
            out.put("name", cursor.getString(0));
            out.put("phone", cursor.getString(1));
            call.resolve(out);
        } catch (SecurityException e) {
            // Only reachable if the one-shot grant on the picked URI is gone,
            // which means the pick did not really happen.
            call.reject("The contact could not be read.", e);
        } catch (Exception e) {
            call.reject("The contact could not be read.", e);
        }
    }

    private void resolveCancelled(PluginCall call) {
        JSObject cancelled = new JSObject();
        cancelled.put("cancelled", true);
        call.resolve(cancelled);
    }
}
