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
      spinnerColor: '#a7d9bc',
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
}

export default config
