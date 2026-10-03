package in.krishikhata.app;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;

import java.util.Collections;

/**
 * An access token for the farmer's OWN Google Drive, with no server anywhere.
 *
 * WHAT THIS IS FOR. The ledger has to survive the phone being lost, and the
 * only backup that can promise that is one held somewhere the farmer still
 * owns after the phone is gone. Their Drive is that place. Krishi Khata has no
 * server, collects nothing, and must keep it that way — so the file goes
 * straight from this phone to that Drive and is never seen by anyone else.
 *
 * WHY AuthorizationClient AND NOT A SIGN-IN SDK. The deprecated GoogleSignIn
 * API is gone from play-services-auth 22, and the Credential Manager that
 * replaced it signs a user IN rather than authorizing a scope. What is needed
 * here is narrower: permission to touch one hidden folder. `authorize()` asks
 * for exactly that, through a system sheet with no browser, against an account
 * already on the device.
 *
 * AND WHY THERE IS NO REFRESH TOKEN. A refresh token can only be obtained by
 * exchanging an auth code on a server, and a server is the one thing this
 * project will not have. It is not needed: once the scope has been granted,
 * `authorize()` returns a fresh access token with NO user interaction at all,
 * for as long as the grant stands. So the app asks for a token every time it
 * uploads, and the farmer sees the consent sheet exactly once.
 *
 * SCOPE IS drive.appdata, DELIBERATELY. It reaches a hidden per-app folder and
 * nothing else — not the farmer's documents, not their photos, not a file this
 * app did not write. It is classified non-sensitive by Google, which is both
 * the honest ask and the one that needs no verification review to publish.
 */
@CapacitorPlugin(name = "GoogleDrive")
public class GoogleDrivePlugin extends Plugin {

    private static final String APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

    /**
     * Ask for a token.
     *
     * `interactive` false is the everyday path: it resolves with granted=false
     * rather than putting a sheet in front of somebody who is in the middle of
     * recording a day's work. The screen that wants consent passes true.
     */
    @PluginMethod
    public void authorize(final PluginCall call) {
        final boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));

        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(APPDATA_SCOPE)))
            .build();

        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    // Consent has not been given yet. Only interrupt when the
                    // farmer asked for this.
                    if (!interactive) {
                        resolveDenied(call, "consent_required");
                        return;
                    }
                    PendingIntent(call, result);
                    return;
                }
                resolveGranted(call, result);
            })
            .addOnFailureListener(e -> call.reject(
                e.getMessage() == null ? "Google authorization failed." : e.getMessage()));
    }

    /** Launch the consent sheet, and pick the result up in `consentResult`. */
    private void PendingIntent(PluginCall call, AuthorizationResult result) {
        try {
            android.app.PendingIntent pending = result.getPendingIntent();
            if (pending == null) {
                resolveDenied(call, "no_resolution");
                return;
            }
            startIntentSenderForResult(call, pending.getIntentSender(), "consentResult");
        } catch (Exception e) {
            call.reject("Could not open the Google consent screen.", e);
        }
    }

    /**
     * Capacitor has no IntentSender helper, so the launch goes through the
     * activity directly and the result arrives on the plugin's own callback.
     */
    private void startIntentSenderForResult(PluginCall call, IntentSender sender, String callbackName) {
        try {
            // An empty Intent carrying the sender: startActivityForResult on the
            // bridge handles ordinary Intents, and this is the one case that
            // needs the sender form.
            getActivity().startIntentSenderForResult(sender, 0x4B48, null, 0, 0, 0);
            // The bridge cannot route an IntentSender result back to a callback,
            // so the token is fetched again silently once the sheet closes. That
            // second call costs nothing and keeps one code path for the token.
            bridge.saveCall(call);
            pendingConsentCallId = call.getCallbackId();
        } catch (IntentSender.SendIntentException e) {
            call.reject("Could not open the Google consent screen.", e);
        }
    }

    private String pendingConsentCallId = null;

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != 0x4B48 || pendingConsentCallId == null) return;

        PluginCall call = bridge.getSavedCall(pendingConsentCallId);
        pendingConsentCallId = null;
        if (call == null) return;

        if (resultCode != Activity.RESULT_OK) {
            resolveDenied(call, "declined");
            return;
        }

        // Consent has just been given, so this second request resolves without
        // any UI and hands back the token.
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(APPDATA_SCOPE)))
            .build();

        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    resolveDenied(call, "declined");
                    return;
                }
                resolveGranted(call, result);
            })
            .addOnFailureListener(e -> call.reject(
                e.getMessage() == null ? "Google authorization failed." : e.getMessage()));
    }

    /** Give the grant up, so the next sign-in can choose another account. */
    @PluginMethod
    public void signOut(final PluginCall call) {
        // There is nothing held locally to clear: no refresh token, no cached
        // credential. Revoking the grant is the farmer's own business and is
        // done from their Google account, so this only reports success and the
        // web layer forgets the account it was using.
        call.resolve();
    }

    /* ------------------------------------------------------------------ */

    private void resolveGranted(PluginCall call, AuthorizationResult result) {
        JSObject out = new JSObject();
        out.put("granted", result.getAccessToken() != null);
        out.put("accessToken", result.getAccessToken());
        // Null on many devices — the token alone is what Drive needs, and the
        // email is only ever shown back to the farmer so they can see which
        // account their ledger is going to.
        out.put("email", result.toGoogleSignInAccount() == null
            ? null
            : result.toGoogleSignInAccount().getEmail());
        call.resolve(out);
    }

    private void resolveDenied(PluginCall call, String reason) {
        JSObject out = new JSObject();
        out.put("granted", false);
        out.put("reason", reason);
        call.resolve(out);
    }
}
