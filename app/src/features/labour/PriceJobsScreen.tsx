import { useState } from 'react'
import { Check, Droplets } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, EmptyState, Field, MoneyInput, Sheet } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { openJobs, priceSession } from '@/data/labour'
import { useI18n } from '@/i18n'
import { formatDate } from '@/lib/date'
import { formatRupees } from '@/lib/money'
import { formatQuantity, lineTotalPaise } from '@/lib/quantity'
import { back } from '@/router'
import type { OpenJob } from '@/data/labour'

/**
 * Piece-rate jobs still waiting for a price.
 *
 * This screen exists because of how spraying is actually paid for: the litres
 * are known day by day, the rate is agreed only when the job finishes, and
 * money often changes hands in between. Until the rate exists the work is
 * genuinely worth nothing in a cash-basis book — so it moves no balance, and
 * anything already handed over is sitting as an advance.
 *
 * Setting the rate here is the moment it all resolves. Every day under the job
 * gets `litres × rate`, and the ordinary FIFO engine then settles the advance
 * against the work it was always for. No separate reconciliation step, because
 * two ways of moving the same money is how a ledger stops balancing.
 */
export function PriceJobsScreen() {
  const { t, lang, nameOf } = useI18n()
  const { data: jobs, loading, reload } = useQuery(openJobs, [])

  const [pricing, setPricing] = useState<OpenJob | null>(null)
  const [rate, setRate] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const unitOf = (j: OpenJob) => (lang === 'en' ? j.unit_short_en : j.unit_short_kn) ?? ''

  const preview =
    pricing && rate != null ? lineTotalPaise(pricing.quantity_milli, rate) : null

  async function submit() {
    if (!pricing || rate == null || rate <= 0) return
    setBusy(true)
    try {
      await priceSession(pricing.session_id, rate)
      setDone(nameOf({ name_en: pricing.labourer_name_en, name_kn: pricing.labourer_name_kn }))
      setPricing(null)
      setRate(null)
      reload()
      setTimeout(() => setDone(null), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title={t('labour.openJobs')} onBack={back} right={<span />}>
      <Page>
        {done ? (
          <div
            className="card p-3 text-sm flex gap-2"
            style={{ background: 'var(--color-income-soft)', color: 'var(--color-income)' }}
          >
            <Check size={17} className="shrink-0 mt-0.5" />
            Priced. Anything already paid to {done} has been set against it.
          </div>
        ) : null}

        <p className="text-sm px-1" style={{ color: 'var(--text-soft)' }}>
          {t('labour.priceHint')}
        </p>

        {loading ? (
          <EmptyState>{t('common.loading')}</EmptyState>
        ) : (jobs ?? []).length === 0 ? (
          <EmptyState>{t('common.empty')}</EmptyState>
        ) : (
          <Card>
            {(jobs ?? []).map((j) => (
              <button
                key={`${j.session_id}:${j.labourer_id}`}
                onClick={() => {
                  setPricing(j)
                  setRate(null)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <Droplets size={19} style={{ color: 'var(--color-transfer)' }} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">
                    {nameOf({ name_en: j.labourer_name_en, name_kn: j.labourer_name_kn })}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--text-faint)' }}>
                    {[
                      nameOf({ name_en: j.head_name_en ?? '', name_kn: j.head_name_kn ?? '' }),
                      nameOf({
                        name_en: j.activity_name_en ?? '',
                        name_kn: j.activity_name_kn ?? '',
                      }),
                      `${formatDate(j.first_date, lang)}${
                        j.last_date !== j.first_date ? ` — ${formatDate(j.last_date, lang)}` : ''
                      }`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="text-sm font-semibold tnum shrink-0">
                  {formatQuantity(j.quantity_milli)} {unitOf(j)}
                </span>
              </button>
            ))}
          </Card>
        )}

        <Sheet
          open={!!pricing}
          onClose={() => setPricing(null)}
          title={t('labour.setPrice')}
          footer={
            <Button full onClick={submit} disabled={busy || rate == null || rate <= 0}>
              {busy ? t('common.loading') : t('common.save')}
            </Button>
          }
        >
          {pricing ? (
            <>
              <div className="card p-3.5">
                <p className="font-semibold">
                  {nameOf({
                    name_en: pricing.labourer_name_en,
                    name_kn: pricing.labourer_name_kn,
                  })}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-soft)' }}>
                  {formatQuantity(pricing.quantity_milli)} {unitOf(pricing)} ·{' '}
                  {pricing.days} {t('labour.days')}
                </p>
              </div>

              <Field
                label={`${t('labour.perUnit')} ${unitOf(pricing) ? `/ ${unitOf(pricing)}` : ''}`}
                required
              >
                <MoneyInput paise={rate} onChange={setRate} />
              </Field>

              {/* The figure this becomes, before it is committed. A rate per
                  litre is not something anybody can multiply in their head
                  against 247.5 litres. */}
              {preview != null ? (
                <div
                  className="card p-3.5 flex items-center justify-between"
                  style={{ background: 'var(--color-brand-50)' }}
                >
                  <span className="text-sm font-medium">{t('labour.earned')}</span>
                  <span
                    className="text-xl font-semibold tnum"
                    style={{ color: 'var(--color-brand-700)' }}
                  >
                    {formatRupees(preview)}
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
        </Sheet>
      </Page>
    </Shell>
  )
}
