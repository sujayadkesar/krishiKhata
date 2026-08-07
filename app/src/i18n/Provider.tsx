import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { primaryOf, translate, translateShort, type Lang } from './strings'
import { I18nContext, type I18nValue } from './index'

/**
 * Language is a device preference, not farm data, so it lives in localStorage
 * rather than the database. Reading it synchronously means the first paint is
 * already in the right language — an app that flashes English and then becomes
 * Kannada looks broken to someone who reads only one of them.
 *
 * This file exports only the component. See ./index.ts for why.
 */

const KEY = 'kk.lang'

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'kn' || stored === 'en' || stored === 'both') return stored
  } catch {
    // Private-mode WebViews can throw on localStorage access.
  }
  return 'kn'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = primaryOf(lang) === 'kn' ? 'kn-IN' : 'en-IN'
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      // The preference simply will not persist; the app still works.
    }
  }, [])

  const value = useMemo<I18nValue>(() => {
    // Fall back across languages rather than showing an empty cell — a head
    // the farmer added with only one name filled in still has to print on a
    // statement.
    const pick = (row: { name_en: string; name_kn: string }, which: 'kn' | 'en') =>
      (which === 'kn' ? row.name_kn || row.name_en : row.name_en || row.name_kn) ?? ''

    return {
      lang,
      setLang,
      t: (key) => translate(key, lang),
      ts: (key) => translateShort(key, lang),
      nameOf: (row) => {
        if (!row) return ''
        if (lang !== 'both') return pick(row, lang)
        const kn = pick(row, 'kn')
        const en = pick(row, 'en')
        // Only show both when they actually differ; "Banana · Banana" on a
        // row the farmer never translated is noise.
        return kn && en && kn !== en ? `${kn} · ${en}` : kn || en
      },
      nameShort: (row) => (row ? pick(row, primaryOf(lang)) : ''),
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
