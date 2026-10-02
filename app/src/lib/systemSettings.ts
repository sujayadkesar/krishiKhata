import { registerPlugin, Capacitor } from '@capacitor/core'

/**
 * Sending the farmer to the phone's own backup screen.
 *
 * The app cannot read whether Android's backup is switched on, cannot switch
 * it on, cannot trigger a backup and cannot find out when one last ran — the
 * API for that is signature-permission only. So rather than keep asserting
 * that records are safe in a Google account, the app opens the screen where
 * the switch and the account name actually are.
 */

interface SystemSettingsPlugin {
  openBackupSettings(): Promise<{ opened: string }>
}

const SystemSettings = registerPlugin<SystemSettingsPlugin>('SystemSettings')

export const canOpenBackupSettings = (): boolean => Capacitor.getPlatform() === 'android'

export async function openBackupSettings(): Promise<boolean> {
  if (!canOpenBackupSettings()) return false
  try {
    await SystemSettings.openBackupSettings()
    return true
  } catch {
    return false
  }
}
