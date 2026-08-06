/**
 * Build-time configuration.
 *
 * Nothing here is a secret. An Android OAuth client has no client secret by
 * design — it is identified by the app's package name and signing certificate,
 * which is why this can sit in the repository and why Drive backup needs no
 * server of its own.
 */

/**
 * Google OAuth client ID, for Drive backup.
 *
 * EMPTY BY DEFAULT, and the app is fully usable that way — backup simply
 * reports that it has not been set up. Filling it in is a free, five-minute
 * job that only the person who owns the app can do, because it is tied to
 * their own Google account:
 *
 *   1. console.cloud.google.com → create a project.
 *   2. APIs & Services → Library → enable "Google Drive API".
 *   3. APIs & Services → Credentials → Create credentials → OAuth client ID
 *      → Android. Package name: in.krishikhata.app
 *      SHA-1: from the keystore the APK is signed with
 *      (`keytool -list -v -keystore <file>`).
 *   4. Also create a "Web application" client; its ID is what goes below —
 *      Android sign-in needs the WEB client ID, not the Android one, which is
 *      the step everyone gets wrong.
 *   5. OAuth consent screen → add the scope
 *      https://www.googleapis.com/auth/drive.file
 *      It is non-sensitive, so there is no verification review and no
 *      hundred-user cap. Publish the app to Production.
 *
 * See docs/BACKUP-SETUP.md for the same thing at more length.
 */
export const GOOGLE_CLIENT_ID = ''

/** Visible in the farmer's Drive, so they can see their backups exist. */
export const DRIVE_FOLDER_NAME = 'Krishi Khata Backups'

/** How many backups to keep in Drive before the oldest are removed. */
export const BACKUP_RETENTION = 12
