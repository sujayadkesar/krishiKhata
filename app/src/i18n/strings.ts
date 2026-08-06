/**
 * Every string the interface shows, in both languages.
 *
 * Kannada is the default: the app is for farmers in Uttara Kannada, and English
 * is the fallback for anyone helping them set it up. Keys are grouped by screen
 * and read as `area.thing`.
 *
 * Keep Kannada SHORT. A label that wraps to two lines pushes the tap target it
 * belongs to off the bottom of a small phone, and these screens are used
 * one-handed, outdoors, often in sunlight.
 */

export type Lang = 'kn' | 'en'

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'kn', label: 'ಕನ್ನಡ' },
  { id: 'en', label: 'English' },
]

type Entry = { kn: string; en: string }

export const STRINGS = {
  /* app */
  'app.name': { kn: 'ಕೃಷಿ ಖಾತೆ', en: 'Krishi Khata' },
  'app.tagline': { kn: 'ರೈತರ ಲೆಕ್ಕ ಪುಸ್ತಕ', en: "The farmer's ledger" },

  /* navigation */
  'nav.home': { kn: 'ಮುಖಪುಟ', en: 'Home' },
  'nav.entries': { kn: 'ವ್ಯವಹಾರ', en: 'Entries' },
  'nav.add': { kn: 'ಸೇರಿಸಿ', en: 'Add' },
  'nav.labour': { kn: 'ಕೂಲಿ', en: 'Labour' },
  'nav.reports': { kn: 'ವರದಿ', en: 'Reports' },
  'nav.settings': { kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್', en: 'Settings' },

  /* common actions */
  'common.save': { kn: 'ಉಳಿಸಿ', en: 'Save' },
  'common.cancel': { kn: 'ರದ್ದು', en: 'Cancel' },
  'common.delete': { kn: 'ಅಳಿಸಿ', en: 'Delete' },
  'common.edit': { kn: 'ಬದಲಾಯಿಸಿ', en: 'Edit' },
  'common.add': { kn: 'ಸೇರಿಸಿ', en: 'Add' },
  'common.done': { kn: 'ಆಯಿತು', en: 'Done' },
  'common.back': { kn: 'ಹಿಂದೆ', en: 'Back' },
  'common.close': { kn: 'ಮುಚ್ಚಿ', en: 'Close' },
  'common.search': { kn: 'ಹುಡುಕಿ', en: 'Search' },
  'common.total': { kn: 'ಒಟ್ಟು', en: 'Total' },
  'common.date': { kn: 'ದಿನಾಂಕ', en: 'Date' },
  'common.amount': { kn: 'ಮೊತ್ತ', en: 'Amount' },
  'common.note': { kn: 'ಟಿಪ್ಪಣಿ', en: 'Note' },
  'common.none': { kn: 'ಯಾವುದೂ ಇಲ್ಲ', en: 'None' },
  'common.today': { kn: 'ಇಂದು', en: 'Today' },
  'common.yesterday': { kn: 'ನಿನ್ನೆ', en: 'Yesterday' },
  'common.optional': { kn: 'ಐಚ್ಛಿಕ', en: 'optional' },
  'common.required': { kn: 'ಅಗತ್ಯ', en: 'required' },
  'common.confirm': { kn: 'ಖಚಿತಪಡಿಸಿ', en: 'Confirm' },
  'common.loading': { kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…', en: 'Loading…' },
  'common.empty': { kn: 'ಇನ್ನೂ ಏನೂ ಇಲ್ಲ', en: 'Nothing here yet' },
  'common.all': { kn: 'ಎಲ್ಲಾ', en: 'All' },
  'common.select': { kn: 'ಆಯ್ಕೆ ಮಾಡಿ', en: 'Select' },

  /* entry kinds */
  'kind.income': { kn: 'ಆದಾಯ', en: 'Income' },
  'kind.expense': { kn: 'ಖರ್ಚು', en: 'Expense' },
  'kind.transfer': { kn: 'ವರ್ಗಾವಣೆ', en: 'Transfer' },

  /* entry form */
  'entry.head': { kn: 'ಬೆಳೆ / ಶೀರ್ಷಿಕೆ', en: 'Crop / Head' },
  'entry.subHead': { kn: 'ಉಪ ಶೀರ್ಷಿಕೆ', en: 'Sub-head' },
  'entry.activity': { kn: 'ಯಾವ ಕೆಲಸ', en: 'Work done' },
  'entry.account': { kn: 'ಖಾತೆ', en: 'Account' },
  'entry.accountIn': { kn: 'ಯಾವ ಖಾತೆಗೆ ಬಂತು', en: 'Received into' },
  'entry.accountOut': { kn: 'ಯಾವ ಖಾತೆಯಿಂದ', en: 'Paid from' },
  'entry.from': { kn: 'ಇಂದ', en: 'From' },
  'entry.to': { kn: 'ಗೆ', en: 'To' },
  'entry.quantity': { kn: 'ಪ್ರಮಾಣ', en: 'Quantity' },
  'entry.unit': { kn: 'ಅಳತೆ', en: 'Unit' },
  'entry.rate': { kn: 'ದರ', en: 'Rate' },
  'entry.ratePerUnit': { kn: 'ಪ್ರತಿ ಅಳತೆಗೆ ದರ', en: 'Rate per unit' },
  'entry.buyer': { kn: 'ಖರೀದಿದಾರ', en: 'Buyer' },
  'entry.shop': { kn: 'ಅಂಗಡಿ', en: 'Shop' },
  'entry.photo': { kn: 'ಬಿಲ್ ಫೋಟೋ', en: 'Bill photo' },
  'entry.saved': { kn: 'ಉಳಿಸಲಾಗಿದೆ', en: 'Saved' },
  'entry.totalHint': { kn: 'ಪ್ರಮಾಣ × ದರ', en: 'quantity × rate' },
  'entry.overrideTotal': { kn: 'ಒಟ್ಟು ಬದಲಾಯಿಸಿ', en: 'Change total' },
  'entry.sameAccount': { kn: 'ಎರಡೂ ಖಾತೆ ಒಂದೇ ಇರುವಂತಿಲ್ಲ', en: 'Pick two different accounts' },

  /* labour */
  'labour.title': { kn: 'ಕೂಲಿ', en: 'Labour' },
  'labour.addWork': { kn: 'ಕೆಲಸದ ದಿನ ಸೇರಿಸಿ', en: 'Add work days' },
  'labour.pay': { kn: 'ಪಾವತಿ', en: 'Pay' },
  'labour.khata': { kn: 'ಖಾತೆ', en: 'Khata' },
  'labour.labourer': { kn: 'ಕೂಲಿಯಾಳು', en: 'Labourer' },
  'labour.labourers': { kn: 'ಕೂಲಿಯಾಳುಗಳು', en: 'Labourers' },
  'labour.groupLead': { kn: 'ಗುಂಪಿನ ಮುಖ್ಯಸ್ಥ', en: 'Group lead' },
  'labour.groupSize': { kn: 'ಎಷ್ಟು ಜನ', en: 'How many people' },
  'labour.individual': { kn: 'ಒಬ್ಬರೇ', en: 'Individual' },
  'labour.group': { kn: 'ಗುಂಪು', en: 'Group' },
  'labour.selectDays': { kn: 'ಬಂದ ದಿನಗಳನ್ನು ಒತ್ತಿ', en: 'Tap the days they worked' },
  'labour.fullDay': { kn: 'ಪೂರ್ಣ ದಿನ', en: 'Full day' },
  'labour.halfDay': { kn: 'ಅರ್ಧ ದಿನ', en: 'Half day' },
  'labour.dayRate': { kn: 'ದಿನದ ಕೂಲಿ', en: 'Daily wage' },
  'labour.halfDayRate': { kn: 'ಅರ್ಧ ದಿನದ ಕೂಲಿ', en: 'Half-day wage' },
  'labour.daysWorked': { kn: 'ಕೆಲಸದ ದಿನಗಳು', en: 'Days worked' },
  // A group lead who brings 12 people for one day worked one day but supplied
  // twelve days of labour. Both figures are true and answer different questions.
  'labour.personDays': { kn: 'ಆಳು-ದಿನ', en: 'person-days' },
  'labour.earned': { kn: 'ಗಳಿಸಿದ್ದು', en: 'Earned' },
  'labour.paid': { kn: 'ಕೊಟ್ಟಿದ್ದು', en: 'Paid' },
  'labour.owed': { kn: 'ಕೊಡಬೇಕಾದದ್ದು', en: 'You owe' },
  'labour.advance': { kn: 'ಮುಂಗಡ', en: 'Advance' },
  'labour.settled': { kn: 'ಚುಕ್ತಾ', en: 'Settled' },
  'labour.balance': { kn: 'ಬಾಕಿ', en: 'Balance' },
  'labour.outstanding': { kn: 'ಬಾಕಿ ಕೂಲಿ', en: 'Unpaid wages' },
  'labour.payTo': { kn: 'ಯಾರಿಗೆ ಕೊಡಬೇಕು', en: 'Pay to' },
  'labour.settles': { kn: 'ಈ ದಿನಗಳಿಗೆ ಸಂದಾಯ', en: 'Settles these days' },
  'labour.advanceNote': {
    kn: 'ಕೆಲಸ ಇಲ್ಲದೆ ಕೊಟ್ಟ ಹಣ ಮುಂಗಡವಾಗಿ ಉಳಿಯುತ್ತದೆ',
    en: 'Money paid with no work outstanding stays as an advance',
  },
  'labour.phone': { kn: 'ಫೋನ್', en: 'Phone' },
  'labour.village': { kn: 'ಊರು', en: 'Village' },
  'labour.noLabourers': {
    kn: 'ಮೊದಲು ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಕೂಲಿಯಾಳುಗಳನ್ನು ಸೇರಿಸಿ',
    en: 'Add labourers in Settings first',
  },

  /* dashboard */
  'dash.thisMonth': { kn: 'ಈ ತಿಂಗಳು', en: 'This month' },
  'dash.income': { kn: 'ಆದಾಯ', en: 'Income' },
  'dash.expense': { kn: 'ಖರ್ಚು', en: 'Expense' },
  'dash.net': { kn: 'ಉಳಿತಾಯ', en: 'Net' },
  'dash.balances': { kn: 'ಖಾತೆ ಶಿಲ್ಕು', en: 'Balances' },
  'dash.byCrop': { kn: 'ಬೆಳೆವಾರು', en: 'By crop' },
  'dash.bySubHead': { kn: 'ಖರ್ಚಿನ ವಿಧ', en: 'Spend by type' },
  'dash.trend': { kn: '12 ತಿಂಗಳ ಬೆಳವಣಿಗೆ', en: '12-month trend' },
  'dash.quickAdd': { kn: 'ಬೇಗ ಸೇರಿಸಿ', en: 'Quick add' },

  /* reports */
  'report.title': { kn: 'ವರದಿಗಳು', en: 'Reports' },
  'report.incomeExpense': { kn: 'ಆದಾಯ ಮತ್ತು ಖರ್ಚು', en: 'Income & Expense' },
  'report.cropWise': { kn: 'ಬೆಳೆವಾರು ಲಾಭ', en: 'Crop-wise profit' },
  'report.labourStatement': { kn: 'ಕೂಲಿಯಾಳಿನ ಖಾತೆ', en: 'Labour statement' },
  'report.labourDues': { kn: 'ಕೂಲಿ ಬಾಕಿ', en: 'Labour dues' },
  'report.dayBook': { kn: 'ದಿನಚರಿ', en: 'Day book' },
  'report.cashBook': { kn: 'ನಗದು ಪುಸ್ತಕ', en: 'Cash book' },
  'report.period': { kn: 'ಅವಧಿ', en: 'Period' },
  'report.download': { kn: 'PDF ಪಡೆಯಿರಿ', en: 'Get PDF' },
  'report.share': { kn: 'ಹಂಚಿಕೊಳ್ಳಿ', en: 'Share' },

  /* settings */
  'set.title': { kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್', en: 'Settings' },
  'set.farmProfile': { kn: 'ತೋಟದ ವಿವರ', en: 'Farm profile' },
  'set.farmName': { kn: 'ತೋಟದ ಹೆಸರು', en: 'Farm name' },
  'set.ownerName': { kn: 'ರೈತರ ಹೆಸರು', en: 'Farmer name' },
  'set.accounts': { kn: 'ಖಾತೆಗಳು', en: 'Accounts' },
  'set.heads': { kn: 'ಬೆಳೆ / ಶೀರ್ಷಿಕೆ', en: 'Crops & Heads' },
  'set.subHeads': { kn: 'ಉಪ ಶೀರ್ಷಿಕೆ', en: 'Sub-heads' },
  'set.activities': { kn: 'ಕೆಲಸದ ವಿಧ', en: 'Work types' },
  'set.units': { kn: 'ಅಳತೆ', en: 'Units' },
  'set.language': { kn: 'ಭಾಷೆ', en: 'Language' },
  'set.backup': { kn: 'ಬ್ಯಾಕಪ್', en: 'Backup' },
  'set.openingBalance': { kn: 'ಆರಂಭಿಕ ಶಿಲ್ಕು', en: 'Opening balance' },
  'set.allowedUnits': { kn: 'ಬಳಸಬಹುದಾದ ಅಳತೆ', en: 'Units it is sold in' },
  'set.inactive': { kn: 'ನಿಷ್ಕ್ರಿಯ', en: 'Inactive' },
  'set.showInactive': { kn: 'ನಿಷ್ಕ್ರಿಯವನ್ನೂ ತೋರಿಸಿ', en: 'Show inactive' },

  /* backup */
  'backup.lastBackup': { kn: 'ಕೊನೆಯ ಬ್ಯಾಕಪ್', en: 'Last backup' },
  'backup.never': { kn: 'ಇನ್ನೂ ಆಗಿಲ್ಲ', en: 'Never' },
  'backup.now': { kn: 'ಈಗ ಬ್ಯಾಕಪ್ ಮಾಡಿ', en: 'Back up now' },
  'backup.restore': { kn: 'ಮರುಸ್ಥಾಪಿಸಿ', en: 'Restore' },
  'backup.signIn': { kn: 'Google ನಲ್ಲಿ ಸೈನ್ ಇನ್ ಮಾಡಿ', en: 'Sign in with Google' },
  'backup.signOut': { kn: 'ಸೈನ್ ಔಟ್', en: 'Sign out' },
  'backup.explain': {
    kn: 'ನಿಮ್ಮ ಮಾಹಿತಿ ಫೋನಿನಲ್ಲೇ ಇರುತ್ತದೆ. ಬ್ಯಾಕಪ್ ಚಾಲು ಮಾಡಿದರೆ ನಿಮ್ಮದೇ Google Drive ಗೆ ಪ್ರತಿ ಹೋಗುತ್ತದೆ.',
    en: 'Your data stays on this phone. Turn on backup and a copy goes to your own Google Drive.',
  },
} satisfies Record<string, Entry>

export type StringKey = keyof typeof STRINGS

export function translate(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang]
}
