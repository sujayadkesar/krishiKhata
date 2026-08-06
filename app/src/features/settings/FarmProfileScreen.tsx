import { useEffect, useState } from 'react'
import { Page, Shell } from '@/components/Shell'
import { Button, Field, Input } from '@/components/ui'
import { Wordmark } from '@/components/Logo'
import { useQuery } from '@/hooks/useQuery'
import { getFarmProfile, saveFarmProfile } from '@/data/masterData'
import { useI18n } from '@/i18n'
import { back } from '@/router'
import type { FarmProfile } from '@/data/masterData'

/**
 * Who the statements belong to.
 *
 * This is the only place the farm's own details are entered, and everything
 * here ends up on the letterhead of every printed report — which is the reason
 * to fill it in, and what the preview below is showing.
 */

const EMPTY: FarmProfile = { farm_name: '', owner_name: '', village: '', phone: '' }

export function FarmProfileScreen() {
  const { t, lang } = useI18n()
  const { data } = useQuery(getFarmProfile, [])
  const [form, setForm] = useState<FarmProfile>(EMPTY)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  async function submit() {
    await saveFarmProfile(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Shell title={t('set.farmProfile')} onBack={back} right={<span />}>
      <Page>
        <Field label={t('set.farmName')} hint="Printed at the top of every statement.">
          <Input
            value={form.farm_name}
            onChange={(v) => setForm({ ...form, farm_name: v })}
            placeholder="ಶ್ರೀ ಗುರು ತೋಟ"
          />
        </Field>

        <Field label={t('set.ownerName')}>
          <Input
            value={form.owner_name}
            onChange={(v) => setForm({ ...form, owner_name: v })}
            placeholder="ಸುಜಯ್"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('labour.village')}>
            <Input
              value={form.village}
              onChange={(v) => setForm({ ...form, village: v })}
              placeholder="ಯಲ್ಲಾಪುರ"
            />
          </Field>
          <Field label={t('labour.phone')}>
            <Input
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v.replace(/[^\d+ ]/g, '') })}
              inputMode="tel"
              maxLength={15}
              placeholder="98450 00000"
            />
          </Field>
        </div>

        <div>
          <p className="field-label">Statement letterhead</p>
          <div className="card p-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-start justify-between gap-3">
              <Wordmark size={30} lang={lang} />
              <div className="text-right text-xs" style={{ color: 'var(--text-faint)' }}>
                {form.village || '—'}
                {form.phone ? <div>{form.phone}</div> : null}
              </div>
            </div>
            <div
              className="mt-3 pt-3 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="font-semibold">{form.farm_name || 'Farm name'}</p>
              <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                {form.owner_name || 'Farmer name'}
              </p>
            </div>
          </div>
        </div>

        <Button full onClick={submit}>
          {saved ? t('entry.saved') : t('common.save')}
        </Button>
      </Page>
    </Shell>
  )
}
