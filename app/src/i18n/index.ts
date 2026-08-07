import { createContext, useContext } from 'react'
import type { Lang, StringKey } from './strings'

/**
 * The i18n context and hook.
 *
 * This module deliberately exports NO components. React Fast Refresh replaces
 * a module wholesale when it hot-updates, and a file exporting both a provider
 * component and the context it feeds gets a new context identity on every
 * edit — every consumer below it then reads null and the screen crashes with
 * "must be used inside I18nProvider" until a full reload. The provider lives
 * in ./Provider.tsx for exactly that reason; keep them apart.
 */

export interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** Full label. In 'both' mode this is "ಕನ್ನಡ · English". */
  t: (key: StringKey) => string
  /** Leading language only — for bottom-nav labels and other tight spots. */
  ts: (key: StringKey) => string
  /** Pick the right column off a master-data row. */
  nameOf: (row: { name_en: string; name_kn: string } | null | undefined) => string
  /** Leading language only, for a master-data row. */
  nameShort: (row: { name_en: string; name_kn: string } | null | undefined) => string
}

export const I18nContext = createContext<I18nValue | null>(null)

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

export type { Lang, StringKey }
