import { registerPlugin, Capacitor } from '@capacitor/core'

/**
 * Getting a worker's name and number out of the phone book.
 *
 * Adding a worker means typing a name and a ten-digit number into a phone
 * while standing in a field, and both are already in the farmer's contacts.
 *
 * TWO ROUTES. `pickOne` opens the system's own picker and needs NO permission:
 * the picker runs in the system's process, and the app receives one row for
 * the one person chosen. `listAll` reads the phone book into the app so it can
 * be searched and a whole crew added at a sitting — that needs READ_CONTACTS,
 * so it is asked for only when the farmer chooses that route, and a refusal
 * falls back to the picker rather than dead-ending.
 *
 * READ ONLY, deliberately. See `ContactPickPlugin.java` for why this is
 * hand-written: the off-the-shelf plugin demands WRITE_CONTACTS as well, so a
 * farm ledger would be asking for the right to edit the address book.
 *
 * Nothing read here is ever transmitted. The app has no server.
 */

export interface PickedContact {
  cancelled: boolean
  name?: string
  phone?: string
}

export interface ContactRow {
  name: string
  phone: string
}

interface ContactPickPlugin {
  pick(): Promise<PickedContact>
  checkPermission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  listContacts(): Promise<{ contacts: ContactRow[] }>
}

const ContactPick = registerPlugin<ContactPickPlugin>('ContactPick')

/**
 * Whether the phone book can be reached at all.
 *
 * False on the web preview, where there is no contacts app — the button is
 * hidden there rather than shown and then failing.
 */
export const canPickContact = (): boolean => Capacitor.getPlatform() === 'android'

/** A ten-digit Indian mobile number, however the contact happened to store it. */
export function tidyPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Contacts routinely carry +91, 0091 or a leading 0. What goes in the ledger
  // is the number somebody would actually dial.
  return digits.replace(/^(0091|91)(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '')
}

/** Has the farmer already allowed the phone book to be searched in-app? */
export async function hasContactsPermission(): Promise<boolean> {
  if (!canPickContact()) return false
  try {
    return (await ContactPick.checkPermission()).granted
  } catch {
    return false
  }
}

/** Ask. Resolves false on a refusal, which is an answer and not an error. */
export async function askContactsPermission(): Promise<boolean> {
  if (!canPickContact()) return false
  try {
    return (await ContactPick.requestPermission()).granted
  } catch {
    return false
  }
}

/**
 * The whole phone book, tidied and sorted, for searching inside the app.
 *
 * Throws with code DENIED when the permission is not held, so the caller can
 * offer the system picker instead.
 */
export async function listAll(): Promise<ContactRow[]> {
  const { contacts } = await ContactPick.listContacts()
  return contacts
    .map((c) => ({ name: c.name.trim(), phone: tidyPhone(c.phone) }))
    .filter((c) => c.name !== '' && c.phone !== '')
}

/**
 * Open the system picker. Resolves cancelled when the farmer backs out, which
 * is an ordinary thing to do and not an error.
 */
export async function pickOne(): Promise<PickedContact> {
  if (!canPickContact()) return { cancelled: true }
  const result = await ContactPick.pick()
  if (result.cancelled) return { cancelled: true }
  return {
    cancelled: false,
    name: (result.name ?? '').trim(),
    phone: tidyPhone(result.phone ?? ''),
  }
}
