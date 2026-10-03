import { useState } from 'react'
import {
  Check, CloudUpload, ExternalLink, RotateCcw, Share2, ShieldCheck, TriangleAlert,
} from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, EmptyState, SectionHeader } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useI18n } from '@/i18n'
import { back } from '@/router'
import {
  disableDrive, driveStatus, enableDrive, restoreFromDrive, syncNow,
} from '@/data/driveBackup'
import {
  decodeBackup, encodeBackup, lastBackupAt, offerFile, restoreSnapshot, shareBackup,
} from '@/data/backup'
import { formatDate, todayISO } from '@/lib/date'
import { canOpenBackupSettings, openBackupSettings } from '@/lib/systemSettings'

/**
 * Backup.
 *
 * TWO LAYERS, AND THE FIRST ONE IS INVISIBLE.
 *
 * Android already backs this app up. The ledger is a SQLite file in the app's
 * own storage, and Android's automatic backup carries that to the user's
 * Google account roughly once a day while the phone is idle, charging and on
 * wi-fi, then restores it when they set up a new phone or reinstall. It needs
 * no sign-in, no permission, no OAuth client and no code of ours — see
 * `res/xml/backup_rules.xml`. That is the WhatsApp-shaped safety net, and it
 * is on for everybody by default.
 *
 * What it cannot do is give the farmer a copy they can hold. It is opaque:
 * they cannot see it, move it, send it to their son, or restore it onto a
 * phone that is already set up. So the second layer is a plain file handed to
 * the share sheet, which they can put in Drive, WhatsApp or a memory card —
 * and restore from at any time.
 *
 * The Google Drive integration that used to sit here is gone. It needed an
 * OAuth client registered against the app's signing certificate, and Play
 * re-signs the app with its own key, so it would have broken for every Play
 * user while continuing to work perfectly in testing. Between Android's own
 * backup and a file the farmer controls, it was buying complexity rather than
 * safety.
 */

export function BackupScreen() {
  const { t, lang } = useI18n()

  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: last, reload } = useQuery(lastBackupAt, [])
  const { data: drive, reload: reloadDrive } = useQuery(driveStatus, [])

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    setError(null)
    setMessage(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const saveCopy = () =>
    run('save', async () => {
      const { rows } = await shareBackup()
      reload()
      setMessage(t('backup.savedRows').replace('{n}', String(rows)))
    })

  async function turnOn() {
    await run('drive', async () => {
      const ok = await enableDrive()
      setMessage(ok ? t('drive.turnedOn') : t('drive.declined'))
      reloadDrive()
    })
  }

  async function turnOff() {
    await run('drive', async () => {
      await disableDrive()
      reloadDrive()
    })
  }

  async function syncNowTap() {
    await run('drive', async () => {
      const res = await syncNow(true)
      setMessage(res.ok ? t('drive.synced') : t('drive.syncFailed'))
      reloadDrive()
    })
  }

  async function restoreDrive() {
    await run('drive', async () => {
      const { restored } = await restoreFromDrive()
      const rows = Object.values(restored).reduce((a, b) => a + b, 0)
      setMessage(t('backup.restoredRows').replace('{n}', String(rows)))
      reloadDrive()
    })
  }

  const onPickFile = (input: HTMLInputElement) =>
    run('restore', async () => {
      const file = input.files?.[0]
      if (!file) return
      const snapshot = await decodeBackup(file, file.name.endsWith('.gz'))
      const { restored, safetyCopy } = await restoreSnapshot(snapshot)

      // The safety copy is offered immediately rather than stored, because the
      // database it describes has just been replaced — there is nowhere safe
      // left to put it inside the app.
      const { blob, gzipped } = await encodeBackup(safetyCopy)
      // Handed over through the share sheet on a phone. The old anchor-click
      // wrote nothing inside a WebView, so this copy — the only way back from
      // restoring the wrong file — never actually existed on the product.
      await offerFile(
        blob,
        `krishi-khata-before-restore-${todayISO()}.json${gzipped ? '.gz' : ''}`,
        t('backup.safetyCopy'),
      )

      const rows = Object.values(restored).reduce((a, b) => a + b, 0)
      setMessage(t('backup.restoredRows').replace('{n}', String(rows)))
      input.value = ''
      reload()
    })

  return (
    <Shell title={t('set.backup')} onBack={back} right={<span />}>
      <Page>
        {/*
          The automatic layer, stated plainly and first.

          A farmer who does not know this exists believes their records are one
          dropped phone away from gone, and that belief is what stops somebody
          entering a whole season's figures. It is also simply true, and a true
          thing that reassures is worth the space.
        */}
        <div
          className="card p-4 flex gap-3"
          style={{
            background: 'var(--color-income-soft)',
            borderColor: 'var(--color-earth-300)',
          }}
        >
          <ShieldCheck
            size={22}
            className="shrink-0 mt-0.5"
            style={{ color: 'var(--color-earth-700)' }}
          />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--color-earth-700)' }}>
              {t('backup.autoTitle')}
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-soft)' }}>
              {t('backup.autoBody')}
            </p>
            {/*
              A door, not a claim.

              The app cannot read whether the phone's backup switch is on,
              cannot switch it on, cannot trigger a backup and cannot find out
              when one last ran. It had been asserting that records were safe
              in a Google account anyway. This sends the farmer to the screen
              where the switch and the account name actually are, so they can
              see for themselves.
            */}
            {canOpenBackupSettings() ? (
              <button
                onClick={() => void openBackupSettings()}
                className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: 'var(--color-earth-700)' }}
              >
                {t('backup.checkPhone')}
                <ExternalLink size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {/*
          GOOGLE DRIVE — the one that can actually promise a new phone works.

          Put above everything else because it is the answer to the question
          this screen exists for. Android's own backup stays below it as a
          second layer, and the file the farmer keeps stays below that as a
          third; none of them cost anything to have all at once.
        */}
        {drive?.available ? (
          <section>
            <SectionHeader>{t('drive.title')}</SectionHeader>
            <div
              className="card p-4"
              style={{
                background: drive.enabled ? 'var(--color-income-soft)' : 'var(--surface-raised)',
                borderColor: drive.enabled ? 'var(--color-income)' : 'var(--border)',
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid place-items-center rounded-xl shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    background: drive.enabled ? 'var(--color-income)' : 'var(--surface-sunken)',
                    color: drive.enabled ? '#fff' : 'var(--text-faint)',
                  }}
                >
                  <CloudUpload size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {drive.enabled ? t('drive.on') : t('drive.off')}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-soft)' }}>
                    {drive.enabled ? drive.email || t('drive.signedIn') : t('drive.offBody')}
                  </p>

                  {drive.enabled ? (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
                      {drive.lastSyncAt
                        ? `${t('drive.lastSynced')}: ${formatDate(drive.lastSyncAt.slice(0, 10), lang)}`
                        : t('drive.never')}
                      {drive.pending ? ` · ${t('drive.pending')}` : ''}
                    </p>
                  ) : null}

                  {/* A failure has to be visible. A backup that silently stopped
                      working is worse than one that was never switched on. */}
                  {drive.enabled && drive.lastError ? (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--color-expense)' }}>
                      {drive.lastError === 'consent' ? t('drive.needsConsent') : t('drive.failed')}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3.5">
                {drive.enabled ? (
                  <>
                    <Button variant="soft" full onClick={() => void turnOff()} disabled={!!busy}>
                      {t('drive.turnOff')}
                    </Button>
                    <Button full onClick={() => void syncNowTap()} disabled={!!busy}>
                      {busy === 'drive' ? t('common.loading') : t('drive.syncNow')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="soft" full onClick={() => void restoreDrive()} disabled={!!busy}>
                      {t('drive.restore')}
                    </Button>
                    <Button full onClick={() => void turnOn()} disabled={!!busy}>
                      {busy === 'drive' ? t('common.loading') : t('drive.turnOn')}
                    </Button>
                  </>
                )}
              </div>

              {drive.enabled ? (
                <button
                  onClick={() => void restoreDrive()}
                  disabled={!!busy}
                  className="mt-2.5 text-sm font-semibold"
                  style={{ color: 'var(--color-brand-600)' }}
                >
                  {t('drive.restore')}
                </button>
              ) : null}

              <p className="text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
                {t('drive.privacy')}
              </p>
            </div>
          </section>
        ) : null}

        {message ? (
          <div
            className="card p-3 text-sm flex gap-2"
            style={{ background: 'var(--color-income-soft)', color: 'var(--color-income)' }}
          >
            <Check size={17} className="shrink-0 mt-0.5" />
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            className="card p-3 text-sm flex gap-2"
            style={{ background: 'var(--color-expense-soft)', color: 'var(--color-expense)' }}
          >
            <TriangleAlert size={17} className="shrink-0 mt-0.5" />
            {error}
          </div>
        ) : null}

        <section>
          <SectionHeader>{t('backup.ownCopy')}</SectionHeader>

          <div className="card p-4 space-y-3">
            <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
              {t('backup.ownCopyBody')}
            </p>

            <button
              onClick={() => void saveCopy()}
              disabled={!!busy}
              className="w-full rounded-xl py-4 font-semibold text-white text-lg flex items-center justify-center gap-2"
              style={{ background: 'var(--color-brand-500)', opacity: busy ? 0.5 : 1 }}
            >
              <Share2 size={20} />
              {busy === 'save' ? t('common.loading') : t('backup.now')}
            </button>

            <p className="text-center text-xs" style={{ color: 'var(--text-faint)' }}>
              {t('backup.lastBackup')}:{' '}
              {last ? formatDate(last.slice(0, 10), lang) : t('backup.never')}
            </p>
          </div>
        </section>

        <section>
          <SectionHeader>{t('backup.restore')}</SectionHeader>
          <Card>
            <label className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer">
              <RotateCcw size={19} style={{ color: 'var(--color-brand-600)' }} />
              <span className="flex-1 text-left">
                <span className="block font-medium">{t('backup.restoreFile')}</span>
                <span className="block text-xs" style={{ color: 'var(--text-faint)' }}>
                  {t('backup.restoreWarn')}
                </span>
              </span>
              <input
                type="file"
                accept=".json,.gz,application/json,application/gzip"
                className="hidden"
                onChange={(e) => void onPickFile(e.currentTarget)}
              />
            </label>
          </Card>
        </section>

        {busy === 'restore' ? <EmptyState>{t('common.loading')}</EmptyState> : null}

        <p className="text-xs px-1" style={{ color: 'var(--text-faint)' }}>
          {t('backup.privacyBody')}
        </p>
      </Page>
    </Shell>
  )
}
