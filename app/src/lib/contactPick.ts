import { registerPlugin, Capacitor } from '@capacitor/core'

/**
 * Picking one person out of the phone book.
 *
 * Adding a worker means typing a name and a ten-digit number into a phone
 * while standing in a field, and both are already in the farmer's contacts.
 * This hands the job to the system's own contact picker.
 *
 * NO PERMISSION IS ASKED FOR, AND NONE IS NEEDED. The picker is the system's,
 * running in the system's process; the app receives one row for the one person
 * chosen and never gains the ability to read the address book. That is worth
 * stating plainly to the farmer — see `contact.privacyBody` — because "this
 * app wants your contacts" is a sentence people have learnt to distrust, and
 * in this case it is not what is happening.
 *
 * See `ContactPickPlugin.java` for why this is hand-written rather than an
 * off-the-shelf dependency: the obvious one demands WRITE_CONTACTS too.
 */

export interface PickedContact {
  cancelled: boolean
  name?: string
  phone?: string
}

interface ContactPickPlugin {
  pick(): Promise<PickedContact>
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
  const local = digits.replace(/^(0091|91)(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '')
  return local
}

/**
 * Open the picker. Resolves cancelled when the farmer backs out, which is an
 * ordinary thing to do and not an error.
 */
export async function pickContact(): Promise<PickedContact> {
  if (!canPickContact()) return { cancelled: true }
  const result = await ContactPick.pick()
  if (result.cancelled) return { cancelled: true }
  return {
    cancelled: false,
    name: (result.name ?? '').trim(),
    phone: tidyPhone(result.phone ?? ''),
  }
}
