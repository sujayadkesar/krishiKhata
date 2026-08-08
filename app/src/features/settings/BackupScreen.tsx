import { useEffect, useState } from 'react'
import { CloudUpload, Share2, RotateCcw, Check, TriangleAlert } from 'lucide-react'
import { Page, Shell } from '@/components/Shell'
import { Button, Card, Confirm, EmptyState, Field, ListRow, SectionHeader, Select, Switch } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useI18n } from '@/i18n'
import { back } from '@/router'
import { setSetting } from '@/data/masterData'
import {
  BACKUP_ENABLED_KEY, BACKUP_FREQUENCY_KEY, backupEnabled, backupFrequencyDays,
  backupFileName, buildSnapshot, decodeBackup, encodeBackup, lastBackupAt,
  markBackedUp, restoreSnapshot, shareBackup,
} from '@/data/backup'
import {
  DriveNotConfigured, deleteBackup, downloadBackup, isDriveConfigured, isSignedIn,
  listBackups, pruneBackups, signOut, uploadBackup,
} from '@/data/drive'
import { BACKUP_RETENTION } from '@/config'
import { formatDate } from '@/lib/date'
import type { DriveFile } from '@/data/drive'

/**
 * Backup.
 *
 * Two routes on purpose. Google Drive is the convenient one, but it needs an
 * OAuth client ID that only the app's owner can create, so the app must be
 * useful before that exists — hence "save a copy", which works everywhere with
 * no setup at all and hands the file to WhatsApp, Files, or a memory card.
 *
 * The last backup date is shown large and first. A backup nobody can see is a
 * backup nobody trusts.
 */

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  // Revoked on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BackupScreen() {
  const { t, lang } = useI18n()

  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [files, setFiles] = useState<DriveFile[] | null>(null)
  const [restoring, setRestoring] = useState<DriveFile | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [frequency, setFrequency] = useState('30')

  const { data: last, reload } = useQuery(lastBackupAt, [])

  useEffect(() => {
    void (async () => {
      setEnabled(await backupEnabled())
      setFrequency(String(await backupFrequencyDays()))
      setSignedIn(await isSignedIn())
    })()
  }, [])

  const configured = isDriveConfigured()

  function fail(err: unknown) {
    setError(
      err instanceof DriveNotConfigured
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err),
    )
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    setError(null)
    setMessage(null)
    try {
      await fn()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const saveLocal = () =>
    run('local', async () => {
      const { rows } = await shareBackup()
      reload()
      setMessage(`Backed up ${rows} records. Choose Drive to keep it safe off the phone.`)
    })

  /**
   * Sign in and back up, as ONE action.
   *
   * They were two taps with a sign-in step in between that produced no visible
   * result, so it was entirely possible to sign in, see nothing happen, and
   * conclude backup was broken. `uploadBackup` asks for a token interactively
   * anyway, so signing in separately was never necessary — Google's own
   * consent sheet is the only prompt the farmer sees, and a backup lands at
   * the end of it.
   *
   * Automatic backup switches itself on the first time this succeeds. Somebody
   * who has just connected Drive wants their records backed up; making them
   * find a second switch to say so only produces farms that connected Drive
   * once and never backed up again.
   */
  const backupNow = () =>
    run('drive', async () => {
      const snapshot = await buildSnapshot()
      const { blob, gzipped } = await encodeBackup(snapshot)
      const file = await uploadBackup(blob, backupFileName(gzipped))
      await pruneBackups(BACKUP_RETENTION)
      await markBackedUp()
      reload()
      setSignedIn(true)
      if (!enabled) {
        setEnabled(true)
        await setSetting(BACKUP_ENABLED_KEY, '1')
      }
      setMessage(`Backed up to Google Drive as ${file.name}.`)
    })

  const refreshList = () =>
    run('list', async () => {
      setFiles(await listBackups())
    })

  const doRestore = (file: DriveFile) =>
    run('restore', async () => {
      setRestoring(null)
      const blob = await downloadBackup(file.id)
      const snapshot = await decodeBackup(blob, file.name.endsWith('.gz'))

      const { restored, safetyCopy } = await restoreSnapshot(snapshot)

      // The safety copy is offered immediately rather than stored, because the
      // database it describes has just been replaced — there is nowhere safe
      // left to put it inside the app.
      const { blob: safeBlob, gzipped } = await encodeBackup(safetyCopy)
      download(safeBlob, `krishi-khata-before-restore-${Date.now()}.json${gzipped ? '.gz' : ''}`)

      const rows = Object.values(restored).reduce((a, b) => a + b, 0)
      setMessage(
        `Restored ${rows} records. A copy of what was here before has been saved to your device.`,
      )
    })

  const onPickFile = (input: HTMLInputElement) =>
    run('file-restore', async () => {
      const file = input.files?.[0]
      if (!file) return
      const snapshot = await decodeBackup(file, file.name.endsWith('.gz'))
      const { restored, safetyCopy } = await restoreSnapshot(snapshot)
      const { blob: safeBlob, gzipped } = await encodeBackup(safetyCopy)
      download(safeBlob, `krishi-khata-before-restore-${Date.now()}.json${gzipped ? '.gz' : ''}`)
      const rows = Object.values(restored).reduce((a, b) => a + b, 0)
      setMessage(`Restored ${rows} records from ${file.name}.`)
      input.value = ''
    })

  return (
    <Shell title={t('set.backup')} onBack={back} right={<span />}>
      <Page>
        <div className="card p-4 text-center">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
            {t('backup.lastBackup')}
          </p>
          <p className="text-xl font-semibold">
            {last ? formatDate(last.slice(0, 10), lang) : t('backup.never')}
          </p>
        </div>

        <p className="text-sm px-1" style={{ color: 'var(--text-soft)' }}>
          {t('backup.explain')}
        </p>

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

        {/*
          ONE BUTTON. Sign-in, consent and the upload itself all happen behind
          it, because "sign in" followed by "now press backup" is a two-step
          journey where the first step shows no result — and a farmer who signs
          in and sees nothing happen concludes it did not work.
        */}
        {configured ? (
          <>
            <button
              onClick={() => void backupNow()}
              disabled={!!busy}
              className="w-full rounded-xl py-4 font-semibold text-white text-lg flex items-center justify-center gap-2"
              style={{ background: 'var(--color-brand-500)', opacity: busy ? 0.5 : 1 }}
            >
              <CloudUpload size={20} />
              {busy === 'drive'
                ? t('common.loading')
                : signedIn
                  ? t('backup.now')
                  : t('backup.signIn')}
            </button>
            <p className="text-center text-xs -mt-2" style={{ color: 'var(--text-faint)' }}>
              {t('backup.driveHint')}
            </p>
          </>
        ) : (
          <>
            <button
              onClick={() => void saveLocal()}
              disabled={!!busy}
              className="w-full rounded-xl py-4 font-semibold text-white text-lg flex items-center justify-center gap-2"
              style={{ background: 'var(--color-brand-500)', opacity: busy ? 0.5 : 1 }}
            >
              <CloudUpload size={20} />
              {busy === 'local' ? t('common.loading') : t('backup.now')}
            </button>
            <p className="text-center text-xs -mt-2" style={{ color: 'var(--text-faint)' }}>
              {t('backup.shareHint')}
            </p>
          </>
        )}

        <div>
          <SectionHeader>{t('backup.otherWays')}</SectionHeader>
          <Card>
            {configured ? (
              <ListRow
                title="Save a copy to this phone"
                subtitle={t('backup.shareHint')}
                leading={<Share2 size={19} style={{ color: 'var(--color-brand-600)' }} />}
                onClick={() => void saveLocal()}
              />
            ) : null}
            <label className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer">
              <RotateCcw size={19} style={{ color: 'var(--color-brand-600)' }} />
              <span className="flex-1 text-left">
                <span className="block font-medium">Restore from a file</span>
                <span className="block text-xs" style={{ color: 'var(--text-faint)' }}>
                  Replaces everything currently in the app
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
        </div>

        {/* Google Drive */}
        <div>
          <SectionHeader>Google Drive</SectionHeader>

          {!configured ? (
            <div
              className="card p-3.5 text-sm space-y-2"
              style={{
                background: 'var(--color-earth-100)',
                borderColor: 'var(--color-earth-300)',
                color: 'var(--color-earth-700)',
              }}
            >
              <p className="font-semibold">Not set up yet</p>
              <p>
                Drive backup needs a Google OAuth client ID, which has to be created once
                against your own Google account. It is free and takes about five minutes —
                see <code>docs/BACKUP-SETUP.md</code>. Everything else in the app works
                without it, and "Save a copy" above already protects your records.
              </p>
            </div>
          ) : (
            <>
              <Card>
                <ListRow
                  title={t('backup.restore')}
                  subtitle="Choose from your Drive backups"
                  leading={<RotateCcw size={19} style={{ color: 'var(--color-brand-600)' }} />}
                  onClick={() => void refreshList()}
                />
                {signedIn ? (
                  <ListRow
                    title={t('backup.signOut')}
                    leading={<Share2 size={19} style={{ color: 'var(--text-faint)' }} />}
                    onClick={() =>
                      void run('signout', async () => {
                        await signOut()
                        setSignedIn(false)
                        setFiles(null)
                      })
                    }
                  />
                ) : null}
              </Card>

              {signedIn ? (
                <div className="card p-3 mt-3 space-y-3" key="auto">
                  <Switch
                    checked={enabled}
                    onChange={(v) => {
                      setEnabled(v)
                      void setSetting(BACKUP_ENABLED_KEY, v ? '1' : '0')
                    }}
                    label="Back up automatically"
                  />
                  {enabled ? (
                    <>
                      <Field label="How often">
                        <Select
                          value={frequency}
                          onChange={(v) => {
                            setFrequency(v)
                            void setSetting(BACKUP_FREQUENCY_KEY, v)
                          }}
                          options={[
                            { value: '7', label: 'Every week' },
                            { value: '15', label: 'Every fortnight' },
                            { value: '30', label: 'Every month' },
                          ]}
                        />
                      </Field>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Backups run while the app is open, not in the background — Krishi
                        Khata keeps no server, so it cannot reach Drive while closed. You
                        may occasionally be asked to confirm with Google again.
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        {files ? (
          <div>
            <SectionHeader>Backups in Drive</SectionHeader>
            {files.length === 0 ? (
              <EmptyState>{t('common.empty')}</EmptyState>
            ) : (
              <Card>
                {files.map((f) => (
                  <ListRow
                    key={f.id}
                    title={f.name}
                    subtitle={formatDate(f.modifiedTime.slice(0, 10), lang)}
                    onClick={() => setRestoring(f)}
                    right={
                      <button
                        aria-label={t('common.delete')}
                        style={{ color: 'var(--text-faint)', fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          void run('delete', async () => {
                            await deleteBackup(f.id)
                            setFiles(await listBackups())
                          })
                        }}
                      >
                        ✕
                      </button>
                    }
                  />
                ))}
              </Card>
            )}
          </div>
        ) : null}

        {busy ? (
          <p className="text-center text-sm" style={{ color: 'var(--text-faint)' }}>
            {t('common.loading')}
          </p>
        ) : null}

        <Confirm
          open={!!restoring}
          danger
          title={t('backup.restore')}
          body={`Restore "${restoring?.name ?? ''}"? Everything currently in the app is replaced. A copy of what is here now will be saved to your device first.`}
          confirmLabel={t('backup.restore')}
          onConfirm={() => restoring && void doRestore(restoring)}
          onCancel={() => setRestoring(null)}
        />

        <div className="pt-2">
          <Button variant="ghost" full onClick={() => void saveLocal()}>
            {busy === 'local' ? t('common.loading') : 'Save a copy now'}
          </Button>
        </div>
      </Page>
    </Shell>
  )
}
