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
  'labour.day': { kn: 'ದಿನ', en: 'day' },
  'labour.howMuchOfTheDay': { kn: 'ಎಷ್ಟು ದಿನ ಕೆಲಸ', en: 'How much of the day' },
  'labour.removeWorkBody': {
    kn: 'ಈ ದಿನದ ಕೆಲಸ ತೆಗೆಯಬೇಕೆ? ಇದಕ್ಕೆ ಹೊಂದಿಸಿದ್ದ ಪಾವತಿ ಮತ್ತೆ ಮುಂಗಡವಾಗುತ್ತದೆ.',
    en: 'Remove this work day? Any payment that had settled it becomes an advance again.',
  },
  'labour.removePayBody': {
    kn: 'ಈ ಪಾವತಿ ತೆಗೆಯಬೇಕೆ? ಅದರಿಂದ ಆದ ಖರ್ಚೂ ಹೋಗುತ್ತದೆ, ಮತ್ತು ಅದು ತೀರಿಸಿದ್ದ ಕೆಲಸ ಮತ್ತೆ ಬಾಕಿ ಆಗುತ್ತದೆ.',
    en: 'Remove this payment? The expense it created goes too, and the work it settled goes back to unpaid.',
  },
  'labour.editWorkNote': {
    kn: 'ಮೊತ್ತ ದರ ಮತ್ತು ದಿನದ ಪ್ರಕಾರ ತಾನಾಗಿ ಲೆಕ್ಕವಾಗುತ್ತದೆ. ಪಾವತಿಗಳು ಮತ್ತೆ ಹೊಂದಿಸಲ್ಪಡುತ್ತವೆ.',
    en: 'The amount follows from the rate and the day. Payments are matched again afterwards.',
  },
  'labour.editPayNote': {
    kn: 'ಇದರಿಂದ ಆದ ಖರ್ಚೂ ಇದರ ಜೊತೆ ಬದಲಾಗುತ್ತದೆ.',
    en: 'The expense this created changes with it.',
  },
  'labour.whoHalfDay': { kn: 'ಅರ್ಧ ದಿನ ಕೆಲಸ ಮಾಡಿದವರು', en: 'Who worked half a day' },
  'labour.whoHalfDayHint': {
    kn: 'ಹೆಸರಿನ ಮೇಲೆ ಒತ್ತಿದರೆ ಅರ್ಧ ದಿನ ಆಗುತ್ತದೆ. ಉಳಿದವರೆಲ್ಲ ಪೂರ್ತಿ ದಿನ.',
    en: 'Tap a name to make it a half day. Everyone else stays a full day.',
  },
  'labour.alreadyRecorded': {
    kn: 'ಇವರಿಗೆ ಈ ದಿನದ ಹಾಜರಿ ಈಗಾಗಲೇ ಹಾಕಿದೆ:',
    en: 'These days are already recorded:',
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
  /* Crops have their own row now, so these two name the SIDE OF THE BOOK
     rather than the thing — income is not only crops, and never was. */
  'set.incomeHeads': { kn: 'ಆದಾಯದ ಶೀರ್ಷಿಕೆ', en: 'Income heads' },
  'set.expenseHeads': { kn: 'ಖರ್ಚಿನ ಶೀರ್ಷಿಕೆ', en: 'Expense heads' },
  'dash.inHand': { kn: 'ಒಟ್ಟು ಶಿಲ್ಕು', en: 'Total on hand' },
  'account.cash': { kn: 'ನಗದು', en: 'Cash' },
  'account.bank': { kn: 'ಬ್ಯಾಂಕ್', en: 'Bank' },
  'account.upi': { kn: 'ಯುಪಿಐ', en: 'UPI' },
  'dash.addHint': { kn: 'ಆದಾಯ ಅಥವಾ ಖರ್ಚು', en: 'Money in or out' },
  'dash.workHint': { kn: 'ಆಳುಗಳ ಹಾಜರಿ', en: 'Attendance for the day' },
  'set.subHeads': { kn: 'ಉಪ ಶೀರ್ಷಿಕೆ', en: 'Sub-heads' },
  /* Field labels and hints across Settings. These were English literals on a
     Kannada-default app: a farmer setting up their own farm was reading half
     a screen in a language they did not choose, which is most of what made
     Settings feel like somebody else's software. */
  /* Picking a worker out of the phone book. */
  'contact.fromPhone': { kn: 'ಫೋನ್ ಪಟ್ಟಿಯಿಂದ ಆರಿಸಿ', en: 'Pick from your phone book' },
  'contact.fromPhoneHint': {
    kn: 'ಹೆಸರು ಮತ್ತು ನಂಬರ್ ತಾನಾಗಿ ತುಂಬುತ್ತದೆ',
    en: 'Fills in the name and number for you',
  },
  'contact.privacyTitle': { kn: 'ಮೊದಲು ಇದನ್ನು ಓದಿ', en: 'Before it opens' },
  'contact.privacyBody': {
    kn: 'ಕೃಷಿ ಖಾತೆ ನಿಮ್ಮ ಫೋನ್ ಪಟ್ಟಿಯನ್ನು ಓದುವುದಿಲ್ಲ. ನೀವು ಆರಿಸುವ ಒಬ್ಬರ ಹೆಸರು ಮತ್ತು ನಂಬರ್ ಮಾತ್ರ ಈ ಆ್ಯಪ್‌ಗೆ ಬರುತ್ತದೆ.',
    en: 'Krishi Khata does not read your phone book. Only the one person you choose comes across — their name and number, nothing else.',
  },
  'contact.pt1': {
    kn: 'ಫೋನ್ ಪಟ್ಟಿ ತೆರೆಯುವುದು ನಿಮ್ಮ ಫೋನೇ ಹೊರತು ಈ ಆ್ಯಪ್ ಅಲ್ಲ. ಯಾವ ಅನುಮತಿಯೂ ಬೇಡ.',
    en: 'Your phone opens its own contact list — not this app. No permission is asked for.',
  },
  'contact.pt2': {
    kn: 'ಈ ಆ್ಯಪ್ ಪೂರ್ತಿ ಆಫ್‌ಲೈನ್. ಯಾವ ಸರ್ವರ್‌ಗೂ, ಕ್ಲೌಡ್‌ಗೂ ಏನೂ ಹೋಗುವುದಿಲ್ಲ.',
    en: 'This app works completely offline. Nothing goes to any server or cloud, ever.',
  },
  'contact.pt3': {
    kn: 'ಬಂದ ಹೆಸರು-ನಂಬರ್ ಇದೇ ಫೋನಿನ ನಿಮ್ಮ ಲೆಕ್ಕದಲ್ಲಿ ಮಾತ್ರ ಉಳಿಯುತ್ತದೆ.',
    en: 'What comes across is saved only in your ledger, on this phone.',
  },
  'contact.added': { kn: '{n} ಜನ ಸೇರಿದರು', en: '{n} added' },
  'contact.allow': { kn: 'ಅನುಮತಿ ಕೊಡಿ', en: 'Allow' },
  'contact.pickOne': { kn: 'ಒಬ್ಬರನ್ನು ಆರಿಸಿ', en: 'Pick just one' },
  'contact.pickSome': { kn: 'ಯಾರನ್ನು ಸೇರಿಸಬೇಕು ಆರಿಸಿ', en: 'Choose who to add' },
  'contact.search': { kn: 'ಹೆಸರು ಅಥವಾ ನಂಬರ್ ಹುಡುಕಿ', en: 'Search a name or number' },
  'contact.refused': {
    kn: 'ಅನುಮತಿ ಸಿಗಲಿಲ್ಲ. “ಒಬ್ಬರನ್ನು ಆರಿಸಿ” ಬಳಸಿ — ಅದಕ್ಕೆ ಯಾವ ಅನುಮತಿಯೂ ಬೇಡ.',
    en: 'Permission was not given. Use "Pick just one" instead — that needs no permission at all.',
  },
  'contact.rateHint': {
    kn: 'ಎಲ್ಲರಿಗೂ ಒಂದೇ ದರ ಇದ್ದರೆ ಇಲ್ಲಿ ಹಾಕಿ. ಖಾಲಿ ಬಿಟ್ಟರೂ ಸರಿ — ಕೆಲಸ ಹಾಕುವಾಗ ಕೇಳುತ್ತದೆ.',
    en: 'One rate for everyone you are adding. Leave it empty if you like — the work screen asks then.',
  },
  'contact.editLater': {
    kn: 'ಹೆಸರು, ನಂಬರ್, ದರ — ಎಲ್ಲವನ್ನೂ ಆಮೇಲೆ ಬದಲಿಸಬಹುದು.',
    en: 'Names, numbers and rates can all be edited afterwards.',
  },
  'contact.open': { kn: 'ಫೋನ್ ಪಟ್ಟಿ ತೆರೆಯಿರಿ', en: 'Open phone book' },
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
  'set.grpMoney': { kn: 'ಆದಾಯ ಮತ್ತು ಖರ್ಚು', en: 'Income and expenses' },
  'set.grpWork': { kn: 'ಬೆಳೆ ಮತ್ತು ಕೆಲಸ', en: 'Crops and work' },
  'set.cropHeads': { kn: 'ಬೆಳೆಗಳು', en: 'Crops' },
  /* Where each list turns up. Shown on the list screen itself. */
  'set.whereIncome': {
    kn: 'ಇಲ್ಲಿ ಸೇರಿಸಿದ್ದು ಎಂಟ್ರಿಯ “ಆದಾಯ” ಭಾಗದಲ್ಲಿ ಬರುತ್ತದೆ. ಬೆಳೆಗೆ ತಳಿ ಇದ್ದರೆ ಅದೂ ಇಲ್ಲೇ ಸೇರಿಸಿ.',
    en: 'These appear in the Income tab when you record an entry. A crop\'s varieties are added here too.',
  },
  'set.whereExpense': {
    kn: 'ಇಲ್ಲಿ ಸೇರಿಸಿದ್ದು ಎಂಟ್ರಿಯ “ಖರ್ಚು” ಭಾಗದಲ್ಲಿ ಬರುತ್ತದೆ. ಬೆಳೆಯ ಖರ್ಚು, ಗಾಡಿ, ಮನೆ, ಸ್ವಂತ ಖರ್ಚು — ಎಲ್ಲವೂ ಇಲ್ಲಿಗೇ.',
    en: 'These appear in the Expense tab. Spending on a crop, the vehicle, the house, personal — all of it goes here.',
  },
  'set.whereCrops': {
    kn: 'ಆಳುಗಳ ಹಾಜರಿ ಹಾಕುವಾಗ “ಯಾವ ಬೆಳೆ” ಎಂಬಲ್ಲಿ ಇದೇ ಪಟ್ಟಿ ಬರುತ್ತದೆ. ಬೆಳೆವಾರು ಕೂಲಿ ಖರ್ಚು ಇದರಿಂದಲೇ ಲೆಕ್ಕವಾಗುತ್ತದೆ.',
    en: 'This list fills the crop box when you record a day of work. Crop-wise labour cost is worked out from it.',
  },
  'set.whereSpendTypes': {
    kn: 'ಖರ್ಚು ಸೇರಿಸುವಾಗ “ಯಾವ ಬಗೆಯ ಖರ್ಚು” ಎಂಬಲ್ಲಿ ಬರುತ್ತದೆ. ಎಲ್ಲಾ ಶೀರ್ಷಿಕೆಗೂ ಇದೇ ಪಟ್ಟಿ.',
    en: 'These appear in the “kind of spending” box on an expense. The same list on every head.',
  },
  'set.whereActivities': {
    kn: 'ಆಳುಗಳ ಹಾಜರಿ ಹಾಕುವಾಗ “ಯಾವ ಕೆಲಸ” ಎಂಬಲ್ಲಿ ಬರುತ್ತದೆ.',
    en: 'These appear in the “which work” box when you record a day of work.',
  },
  'set.whereWorkers': {
    kn: 'ಹಾಜರಿ ಮತ್ತು ಪಾವತಿ ಮಾಡುವಾಗ ಈ ಜನರ ಪಟ್ಟಿ ಬರುತ್ತದೆ.',
    en: 'These are the people offered when you record attendance or make a payment.',
  },
  'set.wherePlots': {
    kn: 'ಎಂಟ್ರಿ ಮತ್ತು ಹಾಜರಿ ಎರಡರಲ್ಲೂ ಬರುತ್ತದೆ. ಪ್ರತಿ ಜಮೀನಿನ ಲಾಭ-ನಷ್ಟ ಪ್ರತ್ಯೇಕ ಸಿಗುತ್ತದೆ.',
    en: 'These appear on both entries and attendance, and each plot gets its own profit line.',
  },
  'set.whereAccounts': {
    kn: 'ಪ್ರತಿ ಎಂಟ್ರಿಯಲ್ಲೂ “ಯಾವ ಖಾತೆಯಿಂದ” ಎಂಬಲ್ಲಿ ಬರುತ್ತದೆ. ಮುಖಪುಟದ ಶಿಲ್ಕು ಇದರಿಂದಲೇ.',
    en: 'These fill the “from which account” box on every entry, and the balances on the home screen.',
  },
  'set.hintCropWork': {
    kn: 'ಹಾಜರಿ ಹಾಕುವಾಗ ಬರುವ ಬೆಳೆಗಳ ಪಟ್ಟಿ',
    en: 'The crops offered when recording a day of work',
  },
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
    kn: 'ಎಂಟ್ರಿಯ ಆದಾಯ ಭಾಗದಲ್ಲಿ ಬರುತ್ತದೆ',
    en: 'What shows up in the Income tab of an entry',
  },
  'set.hintSpend': {
    kn: 'ಬೆಳೆ, ಗಾಡಿ, ಮನೆ — ಖರ್ಚು ಭಾಗದಲ್ಲಿ ಬರುತ್ತದೆ',
    en: 'Crops, vehicle, household — shows up in the Expense tab',
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
  /*
   * HONEST, AND IT DID NOT USED TO BE.
   *
   * This said Android saves your records to your Google account about once a
   * day, flatly, as a fact. It is only true when the phone's own "Back up to
   * Google Drive" switch is on, when the phone is idle, charging and on
   * wi-fi — and the app can verify none of that. It cannot read the switch,
   * trigger a backup, or learn when one last ran. Telling a farmer their
   * season is safe when it might not be is the worst thing this screen could
   * do, so it now says "if", points at where to check, and puts the weight on
   * the copy they take themselves.
   */
  'backup.autoTitle': {
    kn: 'ಫೋನಿನ ಬ್ಯಾಕಪ್ — ಆನ್ ಇದ್ದರೆ ಮಾತ್ರ',
    en: "Your phone's own backup — only if it is on",
  },
  'backup.autoBody': {
    kn: 'ಫೋನಿನಲ್ಲಿ Google ಬ್ಯಾಕಪ್ ಆನ್ ಇದ್ದರೆ, ಚಾರ್ಜ್‌ನಲ್ಲಿ ವೈ-ಫೈ ಇದ್ದಾಗ ಆಂಡ್ರಾಯ್ಡ್ ತಾನಾಗಿ ಸೇವ್ ಮಾಡುತ್ತದೆ. ಅದು ಆಗಿದೆಯೇ ಎಂದು ಈ ಆ್ಯಪ್‌ಗೆ ತಿಳಿಯುವುದಿಲ್ಲ. ಹಾಗಾಗಿ ಕೆಳಗಿನ ನಿಮ್ಮದೇ ಪ್ರತಿಯನ್ನೂ ತೆಗೆದಿಡಿ.',
    en: 'If Google backup is switched on, Android saves your records while the phone is charging on wi-fi. This app cannot check whether that has happened, so keep your own copy below as well.',
  },
  'backup.checkPhone': {
    kn: 'ಫೋನಿನ ಬ್ಯಾಕಪ್ ಸೆಟ್ಟಿಂಗ್ ನೋಡಿ',
    en: "Check your phone's backup setting",
  },
  'backup.dueTitle': {
    kn: 'ಬ್ಯಾಕಪ್ ತೆಗೆದು ಒಂದು ವಾರ ಆಯಿತು',
    en: 'It has been a week since your last backup',
  },
  'backup.neverTitle': {
    kn: 'ಇನ್ನೂ ಒಮ್ಮೆಯೂ ಬ್ಯಾಕಪ್ ತೆಗೆದಿಲ್ಲ',
    en: 'Your records have never been backed up',
  },
  'backup.dueHint': {
    kn: 'ಒತ್ತಿ — ಒಂದು ಫೈಲ್ ಆಗಿ ಸೇವ್ ಮಾಡಿ, Google Drive ಅಥವಾ ವಾಟ್ಸಾಪ್‌ಗೆ ಕಳಿಸಿಡಿ.',
    en: 'Tap to save a copy, and keep it in Google Drive or send it to yourself.',
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
