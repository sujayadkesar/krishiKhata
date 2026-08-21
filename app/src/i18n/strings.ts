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

/**
 * 'both' is English chrome with Kannada names — not everything doubled.
 *
 * Doubling every label produced "ಆದಾಯ · Income" on buttons, tiles and menus,
 * which is noise: words like Entry, Report and Save are understood either way.
 * What genuinely needs Kannada is the farm's own vocabulary — ಬಾಳೆಕಾಯಿ,
 * ಕಾಳುಮೆಣಸು, ಗುಂಡಿ ತೋಡುವುದು, ಕಳೆ ತೆಗೆಯುವುದು — because those are the words
 * spoken in the field and there is no useful English for them.
 *
 * So: interface in English, everything the farmer named in Kannada.
 */
export type Lang = 'kn' | 'en' | 'both'

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'kn', label: 'ಕನ್ನಡ' },
  { id: 'en', label: 'English' },
  { id: 'both', label: 'English + ಕನ್ನಡ ಹೆಸರು' },
]

/** The language whose text leads in 'both' mode. */
export type BaseLang = 'kn' | 'en'
export const primaryOf = (lang: Lang): BaseLang => (lang === 'en' ? 'en' : 'kn')

type Entry = { kn: string; en: string }

export const STRINGS = {
  /* app */
  'app.name': { kn: 'ಕೃಷಿ ಖಾತೆ', en: 'Krishi Khata' },
  'app.tagline': { kn: 'ರೈತರ ಲೆಕ್ಕ ಪುಸ್ತಕ', en: "The farmer's ledger" },

  /* navigation */
  'nav.home': { kn: 'ಮುಖಪುಟ', en: 'Home' },
  'nav.entries': { kn: 'ವ್ಯವಹಾರ', en: 'Entries' },
  'nav.add': { kn: 'ಸೇರಿಸಿ', en: 'Add' },
  // People are "workers", never "labourers".
  //
  // ಕೂಲಿಯಾಳು carries a class edge that the person named on the statement can
  // feel, and these statements get handed to them. ಕೂಲಿ is kept only where it
  // means the WAGE — money is money — but never where it names a person.
  'nav.labour': { kn: 'ಕೆಲಸಗಾರರು', en: 'Team' },
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
  'entry.grade': { kn: 'ದರ್ಜೆ', en: 'Grade' },
  'subhead.usedFor': { kn: 'ಯಾವುದಕ್ಕೆ', en: 'Used for' },
  'subhead.incomeGrade': { kn: 'ಮಾರಾಟದ ದರ್ಜೆ', en: 'Sale grade' },
  'subhead.belongsTo': { kn: 'ಯಾವ ಬೆಳೆಗೆ', en: 'Belongs to crop' },
  'subhead.gradeOf': { kn: 'ದರ್ಜೆ ·', en: 'Grade of' },
  'entry.activity': { kn: 'ಯಾವ ಕೆಲಸ', en: 'Work done' },
  // "Plot" and not "land": most farmers here have two or three, and the word
  // has to be short enough to sit on a chip without wrapping.
  'plot.title': { kn: 'ಜಮೀನು', en: 'Plots' },
  'plot.one': { kn: 'ಜಮೀನು', en: 'Plot' },
  'plot.surveyNo': { kn: 'ಸರ್ವೆ ನಂಬರ್', en: 'Survey no.' },
  'plot.area': { kn: 'ವಿಸ್ತೀರ್ಣ', en: 'Area' },
  'plot.acre': { kn: 'ಎಕರೆ', en: 'acre' },
  'plot.gunta': { kn: 'ಗುಂಟೆ', en: 'gunta' },
  'plot.hectare': { kn: 'ಹೆಕ್ಟೇರ್', en: 'hectare' },
  'plot.notRecorded': { kn: 'ದಾಖಲಾಗಿಲ್ಲ', en: 'Not recorded' },
  'plot.wise': { kn: 'ಜಮೀನುವಾರು', en: 'Plot-wise' },
  'plot.none': {
    kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಜಮೀನು ಸೇರಿಸಿ',
    en: 'Add your plots in Settings',
  },
  'plot.hint': {
    kn: 'ಪ್ರತಿ ಜಮೀನಿನ ಲಾಭ-ನಷ್ಟ ಪ್ರತ್ಯೇಕವಾಗಿ ಕಾಣಲು',
    en: 'So each piece of land shows its own profit and loss',
  },
  'entry.plot': { kn: 'ಜಮೀನು', en: 'Plot' },
  // The two halves of the book: what grows on the land, and everything else
  // the same pocket pays for.
  'head.crops': { kn: 'ಬೆಳೆ', en: 'Crops' },
  'head.general': { kn: 'ಇತರ', en: 'Other' },
  'head.category': { kn: 'ಯಾವ ಬಗೆ', en: 'Kind' },
  'head.isCrop': { kn: 'ಬೆಳೆ (ಜಮೀನಿನಲ್ಲಿ)', en: 'A crop grown on land' },
  'head.isGeneral': { kn: 'ಇತರ ಖರ್ಚು', en: 'Something else' },
  // A crop is sold by variety and each variety by grade: Banana → G9 → first
  // class. "Variety" is the word a trader uses, so it is the word here.
  'entry.variety': { kn: 'ತಳಿ', en: 'Variety' },
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
  'entry.useThis': { kn: 'ಇದನ್ನೇ ಬಳಸಿ', en: 'use this' },
  'entry.sameAccount': { kn: 'ಎರಡೂ ಖಾತೆ ಒಂದೇ ಇರುವಂತಿಲ್ಲ', en: 'Pick two different accounts' },

  /* labour */
  'labour.title': { kn: 'ಕೆಲಸಗಾರರು', en: 'Team' },
  'labour.addWork': { kn: 'ಕೆಲಸದ ದಿನ ಸೇರಿಸಿ', en: 'Add work days' },
  'labour.workShort': { kn: 'ಕೆಲಸ', en: 'Work' },
  'labour.pay': { kn: 'ಪಾವತಿ', en: 'Pay' },
  // Work is not always a day. Spraying is by the litre at a price agreed
  // afterwards; plucking is whatever was asked; a fixed hand draws a month.
  'labour.basis': { kn: 'ಹೇಗೆ ಕೂಲಿ', en: 'How they are paid' },
  'labour.basisDay': { kn: 'ದಿನದ ಲೆಕ್ಕ', en: 'By the day' },
  'labour.basisHour': { kn: 'ಗಂಟೆ ಲೆಕ್ಕ', en: 'By the hour' },
  'labour.hoursPerDay': { kn: 'ದಿನಕ್ಕೆ ಎಷ್ಟು ಗಂಟೆ', en: 'Hours per day' },
  'labour.hours': { kn: 'ಗಂಟೆ', en: 'hr' },
  'labour.hourRate': { kn: 'ಗಂಟೆಗೆ ದರ', en: 'Rate per hour' },
  'labour.basisPiece': { kn: 'ಅಳತೆ ಲೆಕ್ಕ', en: 'By quantity' },
  'labour.basisLump': { kn: 'ಗುತ್ತಿಗೆ', en: 'Agreed amount' },
  'labour.basisSalary': { kn: 'ಮಾಸಿಕ ಸಂಬಳ', en: 'Monthly salary' },
  'labour.quantityPerDay': { kn: 'ದಿನಕ್ಕೆ ಎಷ್ಟು', en: 'How much per day' },
  'labour.agreedAmount': { kn: 'ಒಪ್ಪಿದ ಮೊತ್ತ', en: 'Agreed amount' },
  'labour.lumpHint': {
    kn: 'ಒಬ್ಬರಿಗೆ, ಒಂದು ಕೆಲಸಕ್ಕೆ',
    en: 'Per person, for the whole job',
  },
  'labour.notPricedYet': { kn: 'ದರ ಇನ್ನೂ ನಿಗದಿ ಆಗಿಲ್ಲ', en: 'Price not agreed yet' },
  // Kannada does not inflect this for number the way English does, so one
  // word serves both — which is also why hard-coding "job"/"jobs" leaked
  // English onto a Kannada screen.
  'labour.jobs': { kn: 'ಕೆಲಸ', en: 'jobs' },
  'labour.openJobs': { kn: 'ದರ ನಿಗದಿ ಬಾಕಿ', en: 'Waiting to be priced' },
  'labour.setPrice': { kn: 'ದರ ನಿಗದಿ ಮಾಡಿ', en: 'Set the price' },
  'labour.perUnit': { kn: 'ಪ್ರತಿ ಅಳತೆಗೆ ದರ', en: 'Rate per unit' },
  'labour.priceHint': {
    kn: 'ಕೆಲಸ ಮುಗಿದ ಮೇಲೆ ದರ ಒಪ್ಪಿದಾಗ ಇಲ್ಲಿ ಹಾಕಿ. ಮುಂಗಡ ತಾನಾಗಿ ಹೊಂದಾಣಿಕೆ ಆಗುತ್ತದೆ.',
    en: 'Enter the rate once the job is done. Any advance already paid settles itself against it.',
  },
  'labour.settleFor': { kn: 'ಯಾವ ಅವಧಿಗೆ', en: 'Statement period' },
  'labour.lastMonth': { kn: 'ಕಳೆದ ತಿಂಗಳು', en: 'Last month' },
  'labour.payments': { kn: 'ಪಾವತಿ', en: 'payments' },
  'labour.employment': { kn: 'ಯಾವ ಬಗೆಯ ಕೆಲಸಗಾರ', en: 'Kind of worker' },
  'labour.casual': { kn: 'ದಿನಗೂಲಿ', en: 'Paid per job' },
  'labour.monthly': { kn: 'ಮಾಸಿಕ ಸಂಬಳ', en: 'Monthly salary' },
  'labour.monthlySalary': { kn: 'ತಿಂಗಳ ಸಂಬಳ', en: 'Monthly salary' },
  'labour.postSalary': { kn: 'ಸಂಬಳ ದಾಖಲಿಸಿ', en: 'Post salary' },
  'labour.salaryPosted': { kn: 'ಸಂಬಳ ದಾಖಲಾಗಿದೆ', en: 'Salary already posted' },
  'labour.khata': { kn: 'ಖಾತೆ', en: 'Khata' },
  'labour.labourer': { kn: 'ಕೆಲಸಗಾರ', en: 'Worker' },
  'labour.labourers': { kn: 'ಕೆಲಸಗಾರರು', en: 'Workers' },
  'labour.workerId': { kn: 'ಗುರುತು ಸಂಖ್ಯೆ', en: 'Worker ID' },
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
  'labour.payOut': { kn: 'ಹಣ ಕೊಟ್ಟೆ', en: 'I paid them' },
  'labour.payIn': { kn: 'ಹಣ ವಾಪಸ್ ಬಂತು', en: 'They returned money' },
  'labour.returned': { kn: 'ವಾಪಸ್', en: 'Returned' },
  'labour.advanceHeld': { kn: 'ಮುಂಗಡ ಇಟ್ಟಿದ್ದಾರೆ', en: 'They hold your advance' },
  'labour.workDay': { kn: 'ಕೆಲಸ', en: 'Worked' },
  'labour.workByCrop': { kn: 'ಬೆಳೆವಾರು ಕೆಲಸ', en: 'Work by crop' },
  'labour.earnedVsPaid': { kn: 'ಗಳಿಕೆ ಮತ್ತು ಪಾವತಿ', en: 'Earned against paid' },
  'labour.avgGap': { kn: 'ಸರಾಸರಿ ಪಾವತಿ ಅಂತರ', en: 'Usually paid after' },
  'labour.longest': { kn: 'ಗರಿಷ್ಠ', en: 'longest' },
  'labour.waitingSince': { kn: 'ಇಂದಿನಿಂದ ಬಾಕಿ', en: 'Unpaid since' },
  'labour.days': { kn: 'ದಿನ', en: 'days' },
  'labour.crewForTheDay': { kn: 'ಎಷ್ಟು ಜನ ಬಂದರು', en: 'Who came' },
  'labour.men': { kn: 'ಗಂಡಸರು', en: 'Men' },
  'labour.women': { kn: 'ಹೆಂಗಸರು', en: 'Women' },
  'labour.menRate': { kn: 'ಗಂಡಸರ ಕೂಲಿ', en: 'Men’s wage' },
  'labour.womenRate': { kn: 'ಹೆಂಗಸರ ಕೂಲಿ', en: 'Women’s wage' },
  'labour.peopleTotal': { kn: 'ಜನ', en: 'people' },
  'labour.perDay': { kn: 'ದಿನಕ್ಕೆ', en: 'per day' },
  'labour.recordsWorkOnly': {
    kn: 'ಇದು ಕೆಲಸ ಮಾತ್ರ ದಾಖಲಿಸುತ್ತದೆ. ಹಣ ಕೊಟ್ಟಾಗ ಖರ್ಚು ಆಗುತ್ತದೆ.',
    en: 'This records work only. The expense appears when you pay.',
  },
  'labour.tapHint': {
    kn: 'ಒಮ್ಮೆ ಒತ್ತಿ = ಪೂರ್ಣ ದಿನ, ಎರಡು ಬಾರಿ = ಅರ್ಧ ದಿನ',
    en: 'Tap once for a full day, tap again for half a day',
  },
  /*
   * Paying a worker ALREADY writes the expense — `recordPayment` inserts the
   * entry, dated the payment, tagged to the crop when every day it settles
   * belongs to one. Farmers were re-entering it by hand because nothing on
   * this screen said so, which is a doubled expense in the books. The wording
   * is now a statement of fact rather than a hint about the future.
   */
  'labour.payExpenseNote': {
    kn: 'ಇದು ತಾನಾಗಿಯೇ ಖರ್ಚಿನಲ್ಲಿ ಸೇರುತ್ತದೆ. ಮತ್ತೆ ಪ್ರತ್ಯೇಕ ಎಂಟ್ರಿ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ.',
    en: 'This is added to your expenses automatically. Do not enter it again.',
  },
  'labour.paidAndBooked': {
    kn: 'ಪಾವತಿ ಆಯಿತು · ಖರ್ಚಿನಲ್ಲಿ ಸೇರಿದೆ',
    en: 'Paid · added to expenses',
  },
  'labour.noRateYet': {
    kn: 'ಇವರಿಗೆ ದಿನದ ಕೂಲಿ ಇನ್ನೂ ಹಾಕಿಲ್ಲ. ಈ ದಿನಗಳಿಗೆ ಎಷ್ಟು?',
    en: 'no day rate set yet. What are these days worth?',
  },
  'labour.dayRateHint': {
    kn: 'ಈ ಕೆಲಸಕ್ಕೆ ಮಾತ್ರ. ಹಳೆಯ ಕೆಲಸದ ದರ ಬದಲಾಗುವುದಿಲ್ಲ.',
    en: 'For this job only. It does not change what earlier work was paid at.',
  },
  'labour.pricedNote': {
    kn: 'ದರ ಸೇರಿಸಲಾಯಿತು. {name} ಅವರಿಗೆ ಈಗಾಗಲೇ ಕೊಟ್ಟ ಹಣ ಇದಕ್ಕೆ ಹೊಂದಿಸಲಾಗಿದೆ.',
    en: 'Priced. Anything already paid to {name} has been set against it.',
  },
  'labour.fromWagePayment': { kn: 'ಕೂಲಿ ಪಾವತಿಯಿಂದ', en: 'From a wage payment' },
  'labour.repayNote': {
    kn: 'ಮುಂಗಡ ತೆಗೆದುಕೊಂಡು ವಾಪಸ್ ಕೊಟ್ಟರೆ ಇಲ್ಲಿ ದಾಖಲಿಸಿ',
    en: 'Use this when they hand back money from an advance',
  },
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
  'dash.trend': { kn: 'ತಿಂಗಳವಾರು ಆದಾಯ ಮತ್ತು ಖರ್ಚು', en: 'Income against expense' },
  'dash.cropCompare': { kn: 'ಬೆಳೆವಾರು ಆದಾಯ ಮತ್ತು ಖರ್ಚು', en: 'Which crop is paying' },
  'dash.quickAdd': { kn: 'ಬೇಗ ಸೇರಿಸಿ', en: 'Quick add' },
  'dash.goTo': { kn: 'ಇನ್ನಷ್ಟು', en: 'Go to' },
  'dash.priceTrend': { kn: 'ಸಿಕ್ಕ ದರ', en: 'Price you got' },
  'dash.priceHint': {
    kn: 'ಮಾರಾಟದ ಒಟ್ಟು ಮೊತ್ತ ಮತ್ತು ಪ್ರಮಾಣದಿಂದ ಲೆಕ್ಕ',
    en: 'Worked out from what was actually paid, not the quoted rate',
  },
  'dash.sales': { kn: 'ಮಾರಾಟ', en: 'sales' },
  'dash.spent': { kn: 'ಖರ್ಚಾಗಿದೆ', en: 'spent' },

  /* reports */
  'report.title': { kn: 'ವರದಿಗಳು', en: 'Reports' },
  'report.incomeExpense': { kn: 'ಆದಾಯ ಮತ್ತು ಖರ್ಚು', en: 'Income & Expense' },
  'report.cropWise': { kn: 'ಬೆಳೆವಾರು ಲಾಭ', en: 'Crop-wise profit' },
  'report.labourStatement': { kn: 'ಕೆಲಸ ಮತ್ತು ಪಾವತಿ ವಿವರ', en: 'Work & Payment Statement' },
  'report.labourDues': { kn: 'ಪಾವತಿ ಬಾಕಿ', en: 'Payments due' },
  'report.dayBook': { kn: 'ದಿನಚರಿ', en: 'Day book' },
  'report.cashBook': { kn: 'ನಗದು ಪುಸ್ತಕ', en: 'Cash book' },
  'report.period': { kn: 'ಅವಧಿ', en: 'Period' },
  'report.download': { kn: 'PDF ಪಡೆಯಿರಿ', en: 'Get PDF' },
  'report.workerHint': {
    kn: 'ಆಯ್ಕೆ ಮಾಡಿದ ತಕ್ಷಣ ವರದಿ ತಯಾರಾಗುತ್ತದೆ',
    en: 'The statement is built as soon as you choose',
  },
  'report.share': { kn: 'ವರದಿ ಹಂಚಿಕೊಳ್ಳಿ', en: 'Share report' },

  /* settings */
  'set.title': { kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್', en: 'Settings' },
  'set.farmProfile': { kn: 'ತೋಟದ ವಿವರ', en: 'Farm profile' },
  'set.farmName': { kn: 'ತೋಟದ ಹೆಸರು', en: 'Farm name' },
  'set.ownerName': { kn: 'ರೈತರ ಹೆಸರು', en: 'Farmer name' },
  'set.accounts': { kn: 'ಖಾತೆಗಳು', en: 'Accounts' },
  'set.heads': { kn: 'ಬೆಳೆ / ಶೀರ್ಷಿಕೆ', en: 'Crops & Heads' },
  'set.incomeHeads': { kn: 'ಮಾರಾಟದ ಬೆಳೆ', en: 'What you sell' },
  'set.expenseHeads': { kn: 'ಖರ್ಚಿನ ಶೀರ್ಷಿಕೆ', en: 'What you spend on' },
  'dash.addHint': { kn: 'ಆದಾಯ ಅಥವಾ ಖರ್ಚು', en: 'Money in or out' },
  'dash.workHint': { kn: 'ಆಳುಗಳ ಹಾಜರಿ', en: 'Attendance for the day' },
  'set.subHeads': { kn: 'ಉಪ ಶೀರ್ಷಿಕೆ', en: 'Sub-heads' },
  /* Field labels and hints across Settings. These were English literals on a
     Kannada-default app: a farmer setting up their own farm was reading half
     a screen in a language they did not choose, which is most of what made
     Settings feel like somebody else's software. */
  'set.nameEn': { kn: 'ಹೆಸರು (ಇಂಗ್ಲಿಷ್)', en: 'Name (English)' },
  'set.accountType': { kn: 'ಬಗೆ', en: 'Type' },
  'set.bank': { kn: 'ಬ್ಯಾಂಕ್', en: 'Bank' },
  'set.last4': { kn: 'ಕೊನೆಯ ೪ ಅಂಕಿ', en: 'Last 4 digits' },
  'set.openingHint': {
    kn: 'ಇವತ್ತು ಈ ಖಾತೆಯಲ್ಲಿ ಇರುವ ಮೊತ್ತ. ಎಲ್ಲಾ ಶಿಲ್ಕೂ ಇದರ ಮೇಲೆ ನಿಂತಿದೆ.',
    en: 'What is in this account today. Every balance the app shows builds on this.',
  },
  'set.preselectHint': {
    kn: 'ಈ ಕೆಲಸ ಆರಿಸಿದಾಗ ತಾನಾಗಿ ಬರುತ್ತದೆ. ಬೇಕಾದರೆ ಬದಲಿಸಬಹುದು.',
    en: 'Pre-selected when this work is chosen. Still changeable afterwards.',
  },
  'set.usualRateHint': {
    kn: 'ಸಾಮಾನ್ಯ ದರ. ಖಾಲಿ ಬಿಟ್ಟರೂ ಸರಿ.',
    en: 'The usual figure. Leaving it empty is fine — it is only a starting point.',
  },
  'set.workUnitHint': {
    kn: 'ಲೀಟರ್, ಚೀಲ — ಕೆಲಸ ಯಾವುದರಲ್ಲಿ ಎಣಿಸುತ್ತೀರಿ.',
    en: 'Litres, bags — what the work is counted in.',
  },
  'set.farmNameHint': {
    kn: 'ಪ್ರತಿ ವರದಿಯ ಮೇಲ್ಭಾಗದಲ್ಲಿ ಬರುತ್ತದೆ.',
    en: 'Printed at the top of every statement.',
  },
  'set.salaryHint': {
    kn: 'ತಿಂಗಳಿಗೊಮ್ಮೆ ಕೆಲಸಗಾರರ ಪುಟದಿಂದ ಹಾಕಲಾಗುತ್ತದೆ. ನಂತರ ಪಾವತಿಯಿಂದ ಕಳೆಯುತ್ತದೆ.',
    en: 'Posted once a month from the Team screen, then settled by whatever you pay.',
  },
  'set.groupSizeHint': {
    kn: 'ಸಾಮಾನ್ಯ ಸಂಖ್ಯೆ ಅಷ್ಟೆ. ಪ್ರತಿ ದಿನದ ನಿಜವಾದ ಲೆಕ್ಕ ಆ ದಿನವೇ ಹಾಕುತ್ತೀರಿ.',
    en: 'Just the usual number. You set the real count for each day when recording work.',
  },
  'set.mixedRateHint': {
    kn: 'ತಂಡದಲ್ಲಿ ಗಂಡು-ಹೆಣ್ಣು ದರ ಬೇರೆ ಇರುತ್ತದೆ. ಪ್ರತಿ ದಿನವೂ ಬದಲಿಸಬಹುದು.',
    en: 'Crews are usually mixed and the two rates differ. Still editable each day.',
  },
  'set.halfDayHint': {
    kn: 'ಖಾಲಿ ಬಿಟ್ಟರೆ ದಿನದ ಕೂಲಿಯ ಅರ್ಧ.',
    en: 'Leave empty for half of the daily wage.',
  },
  'set.isLabour': { kn: 'ಇದು ಜನರಿಗೆ ಕೊಡುವ ಕೂಲಿ', en: 'This is wages paid to people' },
  'set.soldOneWay': { kn: 'ಒಂದೇ ಬಗೆಯಲ್ಲಿ ಮಾರಾಟ', en: 'Sold one way only' },
  'set.noOwnSpend': { kn: 'ತನ್ನದೇ ಖರ್ಚಿನ ಬಗೆ ಇಲ್ಲ', en: 'No spend types of its own' },
  'set.alsoExpense': { kn: 'ಇದರ ಮೇಲೆ ಖರ್ಚೂ ಆಗುತ್ತದೆ', en: 'Money is also spent on this' },
  'set.alsoIncome': { kn: 'ಇದರಿಂದ ಆದಾಯವೂ ಬರುತ್ತದೆ', en: 'This also brings income' },
  'set.bothSides': { kn: 'ಆದಾಯ ಮತ್ತು ಖರ್ಚು', en: 'sales and expenses' },
  'set.unitsHint': {
    kn: 'ಬಳಸುವ ಕ್ರಮದಲ್ಲಿ ಒತ್ತಿ. ಮೊದಲನೆಯದು ತಾನಾಗಿ ಬರುತ್ತದೆ.',
    en: 'Tap in the order you use them — the first is offered by default.',
  },
  'set.colour': { kn: 'ಬಣ್ಣ', en: 'Colour' },
  'set.colourHint': {
    kn: 'ಗ್ರಾಫ್, ಪಟ್ಟಿ ಮತ್ತು ವರದಿಗಳಲ್ಲಿ ಇದೇ ಬಣ್ಣ',
    en: 'Used for this crop everywhere — charts, lists, statements',
  },
  'set.spendTypes': { kn: 'ಖರ್ಚಿನ ಬಗೆ', en: 'Kinds of spending' },
  /* Settings groups. Four questions, in the order a farm is set up. */
  'set.grpFarm': { kn: 'ನಿಮ್ಮ ತೋಟ', en: 'Your farm' },
  'set.grpSell': { kn: 'ನೀವು ಮಾರುವುದು', en: 'What you sell' },
  'set.grpSpend': { kn: 'ನೀವು ಖರ್ಚು ಮಾಡುವುದು', en: 'What you spend on' },
  'set.grpWork': { kn: 'ಕೆಲಸ ಮತ್ತು ಆಳುಗಳು', en: 'Work and workers' },
  'set.hintProfile': {
    kn: 'ಹೆಸರು ಮತ್ತು ಊರು — ಪ್ರತಿ ವರದಿಯಲ್ಲಿ ಬರುತ್ತದೆ',
    en: 'Name and village, printed on every statement',
  },
  'set.hintPlots': {
    kn: 'ಪ್ರತಿ ಜಮೀನಿಗೂ ಪ್ರತ್ಯೇಕ ಲಾಭ-ನಷ್ಟ',
    en: 'Each piece of land, so every plot shows its own profit',
  },
  'set.hintAccounts': { kn: 'ನಗದು, ಬ್ಯಾಂಕ್, ಯುಪಿಐ', en: 'Cash, bank and UPI, with opening balances' },
  'set.hintCrops': {
    kn: 'ಬೆಳೆ, ಅದರ ತಳಿ ಮತ್ತು ಅಳತೆ',
    en: 'Crops, their varieties, and the units they sell in',
  },
  'set.hintSpend': {
    kn: 'ಬೆಳೆ, ಗಾಡಿ, ಮನೆ — ದುಡ್ಡು ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತದೆ',
    en: 'Crops, vehicle, household — where the money goes',
  },
  'set.hintSpendKinds': {
    kn: 'ಗೊಬ್ಬರ, ಡೀಸೆಲ್, ದುರಸ್ತಿ',
    en: 'Fertilizer, diesel, repairs — the same list on every head',
  },
  'set.hintWorkers': { kn: 'ಹೆಸರು, ಫೋನ್ ಮತ್ತು ದಿನದ ಕೂಲಿ', en: 'Names, phones and day rates' },
  'set.hintActivities': { kn: 'ಕೊಯ್ಲು, ಔಷಧಿ, ಕಳೆ ತೆಗೆಯುವುದು', en: 'Harvesting, spraying, weeding' },
  'set.varietiesGrades': { kn: 'ತಳಿಗಳು', en: 'Varieties' },
  'set.hasVarieties': {
    kn: 'ಈ ಬೆಳೆಗೆ ಬೇರೆ ಬೇರೆ ತಳಿ ಇದೆಯೇ?',
    en: 'Does this crop come in different kinds?',
  },
  'set.varieties': { kn: 'ತಳಿಗಳು', en: 'Varieties' },
  'set.varietiesHint': {
    kn: 'ಉದಾ: ಜಿ೯, ಮಿಟ್ಕಾ, ಕರಿಬಾಳೆ',
    en: 'For example: G9, Mitka, Karibale',
  },
  'set.addVariety': { kn: 'ತಳಿ ಸೇರಿಸಿ', en: 'Add variety' },
  'set.addGrade': { kn: 'ದರ್ಜೆ ಸೇರಿಸಿ', en: 'Add grade' },
  'set.globalSpend': { kn: 'ಎಲ್ಲಾ ಬೆಳೆಗೂ', en: 'Used on every crop' },
  'set.pickHead': { kn: 'ಯಾವ ಬೆಳೆ', en: 'Which crop' },
  'set.activities': { kn: 'ಕೆಲಸದ ವಿಧ', en: 'Work types' },
  'set.units': { kn: 'ಅಳತೆ', en: 'Units' },
  'set.language': { kn: 'ಭಾಷೆ', en: 'Language' },
  'set.backup': { kn: 'ಬ್ಯಾಕಪ್', en: 'Backup' },
  'set.openingBalance': { kn: 'ಆರಂಭಿಕ ಶಿಲ್ಕು', en: 'Opening balance' },
  'set.allowedUnits': { kn: 'ಬಳಸಬಹುದಾದ ಅಳತೆ', en: 'Units it is sold in' },
  'set.inactive': { kn: 'ನಿಷ್ಕ್ರಿಯ', en: 'Inactive' },
  'set.showInactive': { kn: 'ನಿಷ್ಕ್ರಿಯವನ್ನೂ ತೋರಿಸಿ', en: 'Show inactive' },

  /* backup */
  'backup.autoTitle': {
    kn: 'ಫೋನ್ ತಾನಾಗಿಯೇ ಬ್ಯಾಕಪ್ ಮಾಡುತ್ತದೆ',
    en: 'Your phone backs this up on its own',
  },
  'backup.autoBody': {
    kn: 'ನಿಮ್ಮ Google ಖಾತೆಗೆ ದಿನಕ್ಕೊಮ್ಮೆ ಸೇವ್ ಆಗುತ್ತದೆ. ಹೊಸ ಫೋನ್‌ನಲ್ಲಿ ಈ ಆ್ಯಪ್ ಹಾಕಿದಾಗ ಎಲ್ಲವೂ ವಾಪಸ್ ಬರುತ್ತದೆ. ಸೈನ್ ಇನ್ ಬೇಡ.',
    en: 'Android saves your records to your Google account about once a day, and puts them back when you set up a new phone. No sign-in needed.',
  },
  'backup.ownCopy': { kn: 'ನಿಮ್ಮದೇ ಪ್ರತಿ', en: 'A copy you keep' },
  'backup.ownCopyBody': {
    kn: 'ಒಂದು ಫೈಲ್ ಆಗಿ ಉಳಿಸಿ — Drive, WhatsApp, ಮೆಮೊರಿ ಕಾರ್ಡ್, ಎಲ್ಲಿ ಬೇಕಾದರೂ.',
    en: 'Save it as a file and put it wherever you like — Drive, WhatsApp, a memory card. This is the copy you can hand to somebody.',
  },
  'backup.savedRows': {
    kn: '{n} ದಾಖಲೆಗಳ ಪ್ರತಿ ಸಿದ್ಧ. ಎಲ್ಲಿ ಇಡಬೇಕೆಂದು ಆರಿಸಿ.',
    en: 'A copy of {n} records is ready. Choose where to keep it.',
  },
  'backup.restoredRows': {
    kn: '{n} ದಾಖಲೆಗಳು ಮರುಸ್ಥಾಪನೆ ಆಗಿವೆ. ಹಿಂದಿನ ಪ್ರತಿ ಫೋನಿನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ.',
    en: 'Restored {n} records. A copy of what was here before has been saved to your phone.',
  },
  'backup.restoreFile': { kn: 'ಫೈಲ್‌ನಿಂದ ಮರುಸ್ಥಾಪಿಸಿ', en: 'Restore from a file' },
  'backup.restoreWarn': {
    kn: 'ಈಗಿನ ಎಲ್ಲಾ ದಾಖಲೆಗಳ ಬದಲಿಗೆ ಬರುತ್ತದೆ',
    en: 'Replaces everything currently in the app',
  },
  'backup.privacyBody': {
    kn: 'ನಿಮ್ಮ ಲೆಕ್ಕ ಈ ಫೋನಿನಲ್ಲೇ ಇರುತ್ತದೆ. ಯಾವ ಸರ್ವರ್‌ಗೂ ಹೋಗುವುದಿಲ್ಲ.',
    en: 'Your records stay on this phone. Krishi Khata has no server and sends them nowhere.',
  },
  'backup.lastBackup': { kn: 'ಕೊನೆಯ ಬ್ಯಾಕಪ್', en: 'Last backup' },
  'backup.never': { kn: 'ಇನ್ನೂ ಆಗಿಲ್ಲ', en: 'Never' },
  'backup.now': { kn: 'ಈಗ ಬ್ಯಾಕಪ್ ಮಾಡಿ', en: 'Back up now' },
  'backup.restore': { kn: 'ಮರುಸ್ಥಾಪಿಸಿ', en: 'Restore' },
  'backup.shareHint': {
    kn: 'Google Drive, WhatsApp ಅಥವಾ ಫೈಲ್ಸ್ — ಎಲ್ಲಿ ಬೇಕಾದರೂ ಉಳಿಸಿ',
    en: 'Then pick Google Drive, WhatsApp or Files — wherever you want it kept',
  },
} satisfies Record<string, Entry>

export type StringKey = keyof typeof STRINGS

export function translate(key: StringKey, lang: Lang): string {
  // 'both' takes the English side: the interface is chrome, and doubling it
  // only makes every button longer. Names come through nameOf instead.
  return STRINGS[key][lang === 'both' ? 'en' : lang]
}

/** Just the leading language — for bottom-nav labels and other tight spots. */
export function translateShort(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang === 'both' ? 'en' : primaryOf(lang)]
}
