import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { STRINGS, type Lang, type StringKey } from './strings'

/**
 * Language is a device preference, not farm data, so it lives in localStorage
 * rather than the database. Reading it synchronously means the first paint is
 * already in the right language — an app that flashes English and then becomes
 * Kannada looks broken to someone who reads only one of them.
 */

const KEY = 'kk.lang'

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'kn' || stored === 'en') return stored
  } catch {
    // Private-mode WebViews can throw on localStorage access.
  }
  return 'kn'
}

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: StringKey) => string
  /** Pick the right column off a master-data row. */
  nameOf: (row: { name_en: string; name_kn: string } | null | undefined) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang === 'kn' ? 'kn-IN' : 'en-IN'
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      // Preference simply will not persist; the app still works.
    }
  }, [])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key) => STRINGS[key][lang],
      nameOf: (row) => {
        if (!row) return ''
        // Fall back across languages rather than showing an empty cell — a
        // head the farmer added with only one name filled in still has to
        // print on a statement.
        return (lang === 'kn' ? row.name_kn || row.name_en : row.name_en || row.name_kn) ?? ''
      },
    }),
    [lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

export type { Lang, StringKey }
