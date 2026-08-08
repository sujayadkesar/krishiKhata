import { useEffect, useState } from 'react'
import { CheckCircle2, Download, ShieldCheck } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, SectionHeader } from '@/components/ui'
import { useI18n } from '@/i18n'
import { back } from '@/router'
import {
  APP_VERSION, PERMISSION_REQUIRED, canInstallUpdates, checkForUpdate, downloadAndInstall,
  isNativeApp, openDownload, openInstallSettings,
} from '@/lib/updates'
import type { DownloadProgress, UpdateInfo } from '@/lib/updates'

/**
 * Updating the app without leaving it.
 *
 * A farmer used to receive the APK on WhatsApp, find it again in Downloads,
 * and hope it was the right file. Here the app fetches the release GitHub
 * already published, shows what changed, downloads it with a progress bar, and
 * opens Android's installer. The install goes over the existing app, so the
 * ledger is untouched — which is the sentence the screen leads with, because
 * it is the thing people are actually afraid of.
 */

const megabytes = (b: number) => (b > 0 ? `${(b / 1024 / 1024).toFixed(1)} MB` : '')

type Phase =
  | { at: 'idle' }
  | { at: 'checking' }
  | { at: 'none' }
  | { at: 'found'; update: UpdateInfo }
  | { at: 'downloading'; update: UpdateInfo; progress: DownloadProgress }
  | { at: 'needsPermission'; update: UpdateInfo }
  | { at: 'error'; message: string }

export function UpdateScreen() {
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>({ at: 'idle' })
  const [allowed, setAllowed] = useState(true)

  useEffect(() => {
    void canInstallUpdates().then(setAllowed)
    // A visit to this screen is an explicit ask, so it bypasses the six-hour
    // throttle that the launch-time check uses.
    void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function check() {
    setPhase({ at: 'checking' })
    try {
      const update = await checkForUpdate(true)
      setPhase(update ? { at: 'found', update } : { at: 'none' })
    } catch (err) {
      setPhase({ at: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  async function install(update: UpdateInfo) {
    // A release with no APK attached is all the app can do nothing with; open
    // the release page and let the browser take it from there.
    if (!update.installable || !isNativeApp()) {
      openDownload(update.url)
      return
    }

    setPhase({
      at: 'downloading',
      update,
      progress: { percent: 0, bytes: 0, total: update.sizeBytes },
    })

    try {
      await downloadAndInstall(update, (progress) =>
        setPhase((p) => (p.at === 'downloading' ? { ...p, progress } : p)),
      )
      // Android's installer is now in front. Leave the update on screen: if
      // the farmer cancels it, the button is still there.
      setPhase({ at: 'found', update })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes(PERMISSION_REQUIRED)) {
        setAllowed(false)
        setPhase({ at: 'needsPermission', update })
        return
      }
      setPhase({ at: 'error', message })
    }
  }

  const update =
    phase.at === 'found' || phase.at === 'downloading' || phase.at === 'needsPermission'
      ? phase.update
      : null

  return (
    <Shell title={t('update.title')} onBack={back} right={<span />}>
      <Page>
        <div className="card p-4 flex items-center gap-3">
          <span
            className="grid place-items-center rounded-xl shrink-0"
            style={{ width: 44, height: 44, background: 'var(--color-brand-50)', color: 'var(--color-brand-600)' }}
          >
            <ShieldCheck size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {t('update.current')}
            </p>
            <p className="text-lg font-bold tnum">{APP_VERSION}</p>
          </div>
        </div>

        {phase.at === 'none' ? (
          <div
            className="card p-3.5 flex items-center gap-2.5 text-sm"
            style={{
              background: 'var(--color-income-soft)',
              borderColor: 'transparent',
              color: 'var(--color-income)',
            }}
          >
            <CheckCircle2 size={19} className="shrink-0" />
            {t('update.upToDate')}
          </div>
        ) : null}

        {phase.at === 'error' ? (
          <div
            className="card p-3.5 text-sm"
            style={{
              background: 'var(--color-expense-soft)',
              borderColor: 'transparent',
              color: 'var(--color-expense)',
            }}
          >
            {phase.message}
          </div>
        ) : null}

        {update ? (
          <section>
            <SectionHeader>{t('update.available')}</SectionHeader>
            <div className="card p-4 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tnum">{update.version}</span>
                {update.sizeBytes > 0 ? (
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    {megabytes(update.sizeBytes)}
                  </span>
                ) : null}
              </div>

              <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                {t('update.keepsData')}
              </p>

              {update.notes ? (
                <div>
                  <p
                    className="text-[11px] font-bold uppercase mb-1"
                    style={{ color: 'var(--text-faint)', letterSpacing: '0.05em' }}
                  >
                    {t('update.whatsNew')}
                  </p>
                  <p
                    className="text-sm whitespace-pre-line"
                    style={{ color: 'var(--text-soft)' }}
                  >
                    {update.notes}
                  </p>
                </div>
              ) : null}

              {phase.at === 'downloading' ? (
                <div className="space-y-1.5">
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 8, background: 'var(--surface-sunken)' }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        // A server that sends no length gives -1; an
                        // indeterminate bar sitting at zero looks stuck, so it
                        // is filled rather than left empty.
                        width:
                          phase.progress.percent >= 0 ? `${phase.progress.percent}%` : '100%',
                        background: 'var(--color-brand-500)',
                        opacity: phase.progress.percent >= 0 ? 1 : 0.4,
                      }}
                    />
                  </div>
                  <p className="text-xs tnum" style={{ color: 'var(--text-faint)' }}>
                    {t('update.downloading')}
                    {phase.progress.percent >= 0 ? ` · ${phase.progress.percent}%` : ''}
                  </p>
                </div>
              ) : (
                <Button full onClick={() => void install(update)}>
                  <span className="inline-flex items-center gap-2 justify-center">
                    <Download size={18} /> {t('update.install')}
                  </span>
                </Button>
              )}

              {/* Shown before the attempt when Android has already told us it
                  will refuse, and after it when the attempt was refused. */}
              {!allowed || phase.at === 'needsPermission' ? (
                <div
                  className="rounded-xl p-3 text-sm space-y-2"
                  style={{
                    background: 'var(--color-earth-100)',
                    color: 'var(--color-earth-700)',
                  }}
                >
                  <p>{t('update.needsPermission')}</p>
                  <Button
                    variant="soft"
                    full
                    onClick={async () => {
                      await openInstallSettings()
                      // The farmer comes back from Settings; re-read rather
                      // than assume they said yes.
                      setAllowed(await canInstallUpdates())
                    }}
                  >
                    {t('update.openSettings')}
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <Button
          variant="ghost"
          full
          onClick={() => void check()}
          disabled={phase.at === 'checking' || phase.at === 'downloading'}
        >
          {phase.at === 'checking' ? t('update.checking') : t('update.check')}
        </Button>
      </Page>
    </Shell>
  )
}
