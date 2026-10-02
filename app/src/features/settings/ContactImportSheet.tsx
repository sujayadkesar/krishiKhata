import { useEffect, useMemo, useState } from 'react'
import { BookUser, Check, ShieldCheck, UserPlus } from 'lucide-react'
import { Button, Field, Input, MoneyInput, Sheet } from '@/components/ui'
import { saveLabourer } from '@/data/masterData'
import { useI18n } from '@/i18n'
import {
  askContactsPermission, hasContactsPermission, listAll, pickOne,
} from '@/lib/contactPick'
import type { ContactRow } from '@/lib/contactPick'

/**
 * Signing on a crew from the phone book.
 *
 * Adding a worker meant typing a name and a ten-digit number on a phone, in a
 * field, standing in a field — and then doing it again for the next eleven
 * people. Both halves of it are already in the farmer's contacts.
 *
 * THE PERMISSION IS ASKED FOR HERE, NOT AT INSTALL. A farmer who has just
 * opened a farm ledger for the first time has no idea why it wants their
 * contacts, so asking then gets a refusal — and a refused permission is
 * harder to recover than one never asked for. Asked at the moment they tap
 * "add from my phone book", the reason is the screen they are looking at.
 *
 * A refusal is not a dead end. The system picker needs no permission at all,
 * so that stays available and the sheet offers it.
 *
 * ONE RATE FOR THE WHOLE CREW, optional. Twelve people hired together are
 * usually on the same day rate, and typing it twelve times is the thing this
 * screen exists to stop. Left empty is fine: the work screen asks for a rate
 * when somebody selected has none, and writes it onto those days only.
 */

export function ContactImportSheet({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  /** How many were added, so the caller can say so and reload its list. */
  onImported: (count: number) => void
}) {
  const { t } = useI18n()

  const [granted, setGranted] = useState<boolean | null>(null)
  const [contacts, setContacts] = useState<ContactRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [rate, setRate] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Asked afresh each time it opens: the farmer may have changed their mind in
  // Android settings since, in either direction.
  useEffect(() => {
    if (!open) return
    setError(null)
    setQuery('')
    setChosen([])
    void hasContactsPermission().then(setGranted)
  }, [open])

  useEffect(() => {
    if (!open || granted !== true || contacts) return
    void listAll()
      .then(setContacts)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [open, granted, contacts])

  const shown = useMemo(() => {
    const rows = contacts ?? []
    const q = query.trim().toLowerCase()
    if (!q) return rows.slice(0, 300)
    // Digits match the number, letters match the name — one box for both,
    // because a farmer searching for somebody types whichever they remember.
    const digits = q.replace(/\D/g, '')
    return rows
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (digits.length >= 3 && c.phone.includes(digits)),
      )
      .slice(0, 300)
  }, [contacts, query])

  const keyOf = (c: ContactRow) => `${c.name}|${c.phone}`

  async function allow() {
    setBusy(true)
    try {
      const ok = await askContactsPermission()
      setGranted(ok)
      if (!ok) setError(t('contact.refused'))
    } finally {
      setBusy(false)
    }
  }

  /** The no-permission route: the system's own picker, one person at a time. */
  async function usePicker() {
    setBusy(true)
    try {
      const picked = await pickOne()
      if (picked.cancelled || !picked.name) return
      await saveLabourer(blankWorker(picked.name, picked.phone ?? '', rate ?? 0))
      onImported(1)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function addChosen() {
    if (chosen.length === 0) return
    setBusy(true)
    try {
      let added = 0
      for (const key of chosen) {
        const c = (contacts ?? []).find((x) => keyOf(x) === key)
        if (!c) continue
        await saveLabourer(blankWorker(c.name, c.phone, rate ?? 0))
        added += 1
      }
      onImported(added)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('contact.fromPhone')}
      footer={
        granted === true ? (
          <Button full onClick={addChosen} disabled={busy || chosen.length === 0}>
            {busy
              ? t('common.loading')
              : chosen.length === 0
                ? t('contact.pickSome')
                : `${t('common.add')} ${chosen.length}`}
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="soft" full onClick={usePicker} disabled={busy}>
              {t('contact.pickOne')}
            </Button>
            <Button full onClick={allow} disabled={busy}>
              {t('contact.allow')}
            </Button>
          </div>
        )
      }
    >
      {granted !== true ? (
        /* The reassurance, before anything opens. "This app wants your
           contacts" is a sentence people have learnt to distrust, and here it
           is genuinely not what is happening. */
        <>
          <div className="flex flex-col items-center text-center px-1 pt-1 pb-2">
            <span
              className="grid place-items-center rounded-2xl mb-3"
              style={{
                width: 56,
                height: 56,
                background: 'var(--color-income-soft)',
                color: 'var(--color-income)',
              }}
            >
              <ShieldCheck size={28} />
            </span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>
              {t('contact.privacyBody')}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {(['contact.pt1', 'contact.pt2', 'contact.pt3'] as const).map((k) => (
              <li key={k} className="card flex items-start gap-2.5 px-3.5 py-3">
                <ShieldCheck
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: 'var(--color-income)' }}
                />
                <span className="text-sm leading-snug">{t(k)}</span>
              </li>
            ))}
          </ul>
          {error ? (
            <p className="text-sm mt-2" style={{ color: 'var(--color-expense)' }}>
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <Field label={t('labour.dayRate')} hint={t('contact.rateHint')}>
            <MoneyInput paise={rate} onChange={setRate} />
          </Field>

          <Input value={query} onChange={setQuery} placeholder={t('contact.search')} autoFocus />

          {contacts === null ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-faint)' }}>
              {t('common.loading')}
            </p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-faint)' }}>
              {t('common.empty')}
            </p>
          ) : (
            <div
              className="card rows overflow-y-auto"
              style={{ maxHeight: '45vh' }}
            >
              {shown.map((c) => {
                const key = keyOf(c)
                const on = chosen.includes(key)
                return (
                  <button
                    key={key}
                    onClick={() =>
                      setChosen((ids) => (on ? ids.filter((x) => x !== key) : [...ids, key]))
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span
                      className="grid place-items-center rounded-lg shrink-0"
                      style={{
                        width: 30,
                        height: 30,
                        background: on ? 'var(--color-brand-500)' : 'var(--surface-sunken)',
                        color: on ? '#fff' : 'var(--text-faint)',
                      }}
                    >
                      {on ? <Check size={16} /> : <UserPlus size={15} />}
                    </span>
                    <span className="flex-1 min-w-0 leading-tight">
                      <span className="block font-medium truncate">{c.name}</span>
                      <span className="block text-xs tnum" style={{ color: 'var(--text-faint)' }}>
                        {c.phone}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            <BookUser size={13} className="inline mr-1" />
            {t('contact.editLater')}
          </p>

          {error ? (
            <p className="text-sm" style={{ color: 'var(--color-expense)' }}>
              {error}
            </p>
          ) : null}
        </>
      )}
    </Sheet>
  )
}

/**
 * A worker with just a name, a number and maybe a rate.
 *
 * Everything else is left at its default and editable afterwards: the point of
 * this screen is to get twelve people into the book in one sitting, not to
 * fill in twelve forms.
 *
 * The contact's name goes into BOTH columns as stored. It is not
 * transliterated either way — a Latin-script name guessed into Kannada would
 * be a wrong spelling of somebody's name, which is worse than seeing it in the
 * script their phone already holds. The farmer can correct either column.
 */
const blankWorker = (name: string, phone: string, ratePaise: number) => ({
  name_en: name,
  name_kn: name,
  phone: phone || null,
  village: null,
  is_group_lead: 0 as const,
  daily_rate_paise: ratePaise,
  half_day_rate_paise: null,
  female_rate_paise: null,
  typical_group_size: null,
  note: null,
})
