import { useState } from 'react'
import { Phone, IndianRupee, Trash2 } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, Confirm, EmptyState, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import {
  attendanceFor, deleteAttendance, deletePayment, labourBalances, paymentsFor,
} from '@/data/labour'
import { useI18n } from '@/i18n'
import { formatRupees } from '@/lib/money'
import { balanceState } from '@/lib/labour'
import { formatDate } from '@/lib/date'
import { FULL_DAY } from '@/db/types'
import { back, navigate } from '@/router'

/**
 * One labourer's khata: what they worked, what they were paid, what is left.
 *
 * Work and money are listed separately rather than interleaved, because they
 * are separate things in this app and merging them into one running column is
 * exactly the confusion the design avoids.
 */

export function LabourerDetailScreen({ id }: { id: string }) {
  const { t, nameOf, lang } = useI18n()
  const { data: balances } = useQuery(() => labourBalances(true), [])
  const { data: work } = useQuery(() => attendanceFor(id), [id])
  const { data: payments } = useQuery(() => paymentsFor(id), [id])

  const [removeWork, setRemoveWork] = useState<string | null>(null)
  const [removePay, setRemovePay] = useState<string | null>(null)

  const me = balances?.find((b) => b.labourer_id === id)
  const state = balanceState(me?.balance_paise ?? 0)
  const colour =
    state === 'owed'
      ? 'var(--color-expense)'
      : state === 'advance'
        ? 'var(--color-transfer)'
        : 'var(--text-faint)'

  return (
    <Shell
      title={me ? nameOf(me) : t('labour.labourer')}
      onBack={back}
      right={
        me?.phone ? (
          <a href={`tel:${me.phone}`} aria-label="Call" style={{ color: 'var(--color-brand-600)' }}>
            <Phone size={20} />
          </a>
        ) : (
          <span />
        )
      }
    >
      <Page>
        <div className="card p-4 text-center">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
            {state === 'advance' ? t('labour.advance') : t('labour.balance')}
          </p>
          <p className="text-3xl font-semibold tnum" style={{ color: colour }}>
            {formatRupees(Math.abs(me?.balance_paise ?? 0))}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            {state === 'owed'
              ? t('labour.owed')
              : state === 'advance'
                ? 'They are holding your advance'
                : t('labour.settled')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            [t('labour.daysWorked'), String(me?.days ?? 0)],
            [t('labour.earned'), formatRupees(me?.earned_paise ?? 0)],
            [t('labour.paid'), formatRupees(me?.paid_paise ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="card p-3">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-soft)' }}>
                {label}
              </p>
              <p className="text-base font-semibold tnum truncate">{value}</p>
            </div>
          ))}
        </div>

        <Button full onClick={() => navigate(`/labour/pay/${id}`)}>
          <span className="inline-flex items-center gap-2 justify-center">
            <IndianRupee size={17} /> {t('labour.pay')}
          </span>
        </Button>

        <div>
          <SectionHeader>{t('labour.daysWorked')}</SectionHeader>
          {!work?.length ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <Card>
              {work.map((w) => {
                const settled = w.paid_paise >= w.amount_paise
                return (
                  <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">
                        {formatDate(w.date, lang)}
                        {w.day_fraction !== FULL_DAY ? (
                          <span style={{ color: 'var(--text-faint)' }}> · ½</span>
                        ) : null}
                        {w.group_size > 1 ? (
                          <span style={{ color: 'var(--color-earth-700)' }}> · {w.group_size} ಜನ</span>
                        ) : null}
                      </span>
                      <span className="block text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                        {[
                          w.head_name_en
                            ? nameOf({ name_en: w.head_name_en, name_kn: w.head_name_kn ?? '' })
                            : null,
                          w.activity_name_en
                            ? nameOf({
                                name_en: w.activity_name_en,
                                name_kn: w.activity_name_kn ?? '',
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>

                    <span className="text-right shrink-0">
                      <span className="block tnum text-sm font-semibold">
                        {formatRupees(w.amount_paise)}
                      </span>
                      <span
                        className="block text-[11px]"
                        style={{ color: settled ? 'var(--color-income)' : 'var(--color-expense)' }}
                      >
                        {settled ? t('labour.settled') : t('labour.outstanding')}
                      </span>
                    </span>

                    <button
                      onClick={() => setRemoveWork(w.id)}
                      aria-label={t('common.delete')}
                      style={{ color: 'var(--text-faint)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </Card>
          )}
        </div>

        <div>
          <SectionHeader>{t('labour.paid')}</SectionHeader>
          {!payments?.length ? (
            <EmptyState>{t('common.empty')}</EmptyState>
          ) : (
            <Card>
              {payments.map((p) => {
                const unallocated = p.amount_paise - p.allocated_paise
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{formatDate(p.date, lang)}</span>
                      <span className="block text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                        {[
                          p.account_name_en
                            ? nameOf({
                                name_en: p.account_name_en,
                                name_kn: p.account_name_kn ?? '',
                              })
                            : null,
                          unallocated > 0 ? `${formatRupees(unallocated)} ${t('labour.advance')}` : null,
                          p.note,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>

                    <span className="tnum text-sm font-semibold" style={{ color: 'var(--color-expense)' }}>
                      {formatRupees(p.amount_paise)}
                    </span>

                    <button
                      onClick={() => setRemovePay(p.id)}
                      aria-label={t('common.delete')}
                      style={{ color: 'var(--text-faint)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </Card>
          )}
        </div>

        <Confirm
          open={!!removeWork}
          danger
          title={t('common.delete')}
          body="Remove this work day? Any payment that had settled it becomes an advance again."
          confirmLabel={t('common.delete')}
          onConfirm={async () => {
            const target = removeWork!
            setRemoveWork(null)
            await deleteAttendance(target)
          }}
          onCancel={() => setRemoveWork(null)}
        />

        <Confirm
          open={!!removePay}
          danger
          title={t('common.delete')}
          body="Remove this payment? The expense it created is removed too, and the work it settled goes back to unpaid."
          confirmLabel={t('common.delete')}
          onConfirm={async () => {
            const target = removePay!
            setRemovePay(null)
            await deletePayment(target)
          }}
          onCancel={() => setRemovePay(null)}
        />
      </Page>
    </Shell>
  )
}
