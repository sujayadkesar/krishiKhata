/**
 * Build-time configuration.
 *
 * Deliberately almost empty, and that is the point. Krishi Khata has no server,
 * no account, no analytics and no API keys: everything it knows lives in a
 * SQLite file on the phone. There is nothing here to configure because there
 * is nothing to connect to.
 *
 * Two things used to live here and are gone on purpose:
 *
 *   UPDATE_REPO — the app used to poll GitHub releases and install its own
 *   APK. Google Play forbids an app updating itself by any route other than
 *   Play's own, so on Play that mechanism is not merely unnecessary, it is a
 *   suspension risk. Play does updates now.
 *
 *   GOOGLE_CLIENT_ID — Drive backup needed an OAuth client tied to the app's
 *   signing certificate, and Play re-signs the app with its own key, so the
 *   registration would have silently stopped matching. Backup is now the
 *   phone's own: Android's automatic backup carries the database to the
 *   user's Google account with no sign-in at all, and "save a copy" hands
 *   them a file they can put wherever they like. See data/backup.ts.
 */

/** Suffix on the file the farmer saves or shares. */
export const BACKUP_FILE_PREFIX = 'krishi-khata-backup'
