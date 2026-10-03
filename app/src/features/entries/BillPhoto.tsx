import { useEffect, useState } from 'react'
import { Camera, Images, Receipt, Trash2, X, ZoomIn } from 'lucide-react'
import { useI18n } from '@/i18n'
import { getPhoto, savePhoto } from '@/data/entries'
import { captureBill, canTakePhoto, MAX_BYTES, approxBytes } from '@/lib/bill'

/**
 * The bill behind an entry.
 *
 * A farmer is handed a paper slip at the shop and it is illegible within a
 * season; the entry is in the app, so the proof of it should be too. "What was
 * that ₹4,000 for" is the question this answers when the answer is six months
 * old.
 *
 * TWO WAYS IN, because both happen. The slip is in your hand at the counter —
 * that is the camera. Or it was photographed days ago and the entry is being
 * caught up on a Sunday evening — that is the gallery.
 *
 * The thumbnail is a real preview, not a paperclip icon. A list of entries
 * where one says "has a photo" tells you nothing you wanted to know; seeing
 * the slip is the whole point, so it is shown, and tapping it fills the
 * screen.
 */

export function BillPhoto({
  photoId,
  onChange,
  readOnly = false,
}: {
  photoId: string | null
  /** Called with the new photo's id, or null when it is removed. */
  onChange: (id: string | null) => void
  readOnly?: boolean
}) {
  const { t } = useI18n()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!photoId) {
      setDataUrl(null)
      return
    }
    void getPhoto(photoId).then((d) => {
      if (!cancelled) setDataUrl(d)
    })
    return () => {
      cancelled = true
    }
  }, [photoId])

  async function take(source: 'camera' | 'gallery') {
    setBusy(true)
    setError(null)
    try {
      const shot = await captureBill(source)
      if (!shot) return
      if (approxBytes(shot) > MAX_BYTES) {
        setError(t('bill.tooBig'))
        return
      }
      const id = await savePhoto(shot)
      setDataUrl(shot)
      onChange(id)
    } catch (e) {
      // Backing out of the camera throws on some devices. Only say something
      // when there is genuinely something to say.
      const msg = e instanceof Error ? e.message : String(e)
      if (!/cancel/i.test(msg)) setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (readOnly && !dataUrl) return null

  return (
    <>
      <div>
        <span className="field-label">{t('bill.label')}</span>

        {dataUrl ? (
          <div className="card overflow-hidden">
            <button
              onClick={() => setFull(true)}
              className="relative block w-full"
              style={{ lineHeight: 0 }}
            >
              <img
                src={dataUrl}
                alt={t('bill.label')}
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }}
              />
              <span
                className="absolute bottom-2 right-2 grid place-items-center rounded-lg"
                style={{ width: 30, height: 30, background: 'rgba(0,0,0,.55)', color: '#fff' }}
              >
                <ZoomIn size={16} />
              </span>
            </button>

            {!readOnly ? (
              <div className="flex rows">
                <button
                  onClick={() => void take('camera')}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium"
                  style={{ color: 'var(--color-brand-600)' }}
                >
                  <Camera size={15} /> {t('bill.retake')}
                </button>
                <button
                  onClick={() => {
                    setDataUrl(null)
                    onChange(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium"
                  style={{ color: 'var(--color-expense)', borderLeft: '1px solid var(--border)' }}
                >
                  <Trash2 size={15} /> {t('common.delete')}
                </button>
              </div>
            ) : null}
          </div>
        ) : canTakePhoto() ? (
          <div className="grid grid-cols-2 gap-3">
            <BillButton
              icon={<Camera size={20} />}
              label={t('bill.camera')}
              onClick={() => void take('camera')}
              disabled={busy}
            />
            <BillButton
              icon={<Images size={20} />}
              label={t('bill.gallery')}
              onClick={() => void take('gallery')}
              disabled={busy}
            />
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            <Receipt size={14} className="inline mr-1.5" />
            {t('bill.phoneOnly')}
          </p>
        )}

        {error ? (
          <p className="text-sm mt-2" style={{ color: 'var(--color-expense)' }}>
            {error}
          </p>
        ) : null}
      </div>

      {/* Full screen, because a bill is read by zooming into the one line that
          matters and a thumbnail cannot be read at all. */}
      {full && dataUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.92)' }}
          onClick={() => setFull(false)}
        >
          <button
            onClick={() => setFull(false)}
            aria-label={t('common.close')}
            className="absolute top-4 right-4 grid place-items-center rounded-full"
            style={{ width: 40, height: 40, background: 'rgba(255,255,255,.15)', color: '#fff' }}
          >
            <X size={20} />
          </button>
          <img
            src={dataUrl}
            alt={t('bill.label')}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      ) : null}
    </>
  )
}

function BillButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card flex flex-col items-center justify-center gap-1.5 py-4 active:scale-[.98] transition"
      style={{ color: 'var(--color-brand-700)', opacity: disabled ? 0.5 : 1 }}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  )
}
