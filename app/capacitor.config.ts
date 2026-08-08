import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The app id is permanent. Android identifies an installed app by it, so
 * changing it later means every farmer uninstalls and loses their data — and
 * from 2027 it is also what a package name is registered against under
 * Google's developer verification.
 */
const config: CapacitorConfig = {
  appId: 'in.krishikhata.app',
  appName: 'Krishi Khata',
  webDir: 'dist',
  android: {
    // The ledger is worth more than a slightly nicer scroll: this keeps the
    // WebView from swallowing errors on older devices.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#12502c',
      androidSpinnerStyle: 'small',
      spinnerColor: '#f4a26c',
    },
    /*
     * The app is light-only, so the bar is light with dark icons regardless of
     * what the phone is set to. Left on the default, a phone in dark mode drew
     * white icons on the app's cream header and they vanished.
     */
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#fdf7ef',
      overlaysWebView: false,
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
}

export default config
