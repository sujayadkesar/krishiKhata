package in.krishikhata.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Picking ONE person out of the phone book, with no permission at all.
 *
 * Adding a worker means typing a name and a ten-digit number on a phone, in
 * a field, standing in a field. Both are already in the farmer's contacts.
 *
 * WHY THIS IS HAND-WRITTEN RATHER THAN A PLUGIN OFF THE SHELF. The obvious
 * dependency bundles READ_CONTACTS and WRITE_CONTACTS into one permission
 * alias and will not proceed until BOTH are granted — so a ledger that wants
 * a name and a number would have to ask for the right to modify the address
 * book, and the Play listing would say so.
 *
 * ACTION_PICK needs neither. The picker belongs to the system, it runs in the
 * system's process with the system's own search, and it hands back a URI the
 * app is granted one-shot read access to. The whole address book is never
 * readable by this app — only the one row the farmer chose, once. That is
 * both the smaller ask and the better story to put in front of somebody who
 * has been told an app wants their contacts.
 *
 * Picking on CommonDataKinds.Phone.CONTENT_URI rather than Contacts.CONTENT_URI
 * matters: it lists phone numbers instead of people, so somebody with three
 * numbers is three rows and the farmer chooses which one, rather than the app
 * guessing. It also means the number is in the row that comes back and no
 * second lookup — which WOULD need the permission — is required.
 */
@CapacitorPlugin(name = "ContactPick")
public class ContactPickPlugin extends Plugin {

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
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
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
}
