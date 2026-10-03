import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

/**
 * Photographing a bill.
 *
 * A farmer is handed a paper slip at the fertilizer shop and it is illegible
 * within a season. The entry is in the app; the proof of it should be too.
 *
 * SIZE IS THE WHOLE PROBLEM. A phone camera produces three to five megabytes
 * a shot, the photo is stored base64 in SQLite, and the database is what the
 * backup carries — Android's own automatic backup refuses anything over 25 MB
 * and does so SILENTLY, so twenty unshrunk bills would quietly stop the whole
 * farm being backed up at all. Everything here is in service of that: the
 * capture is already downscaled by the camera, and then checked again and
 * re-encoded if it is still too big.
 *
 * A bill only has to be READABLE, not archival. 1280px on the long edge at
 * quality 55 lands around 150–250 KB and a shop slip is perfectly legible.
 */

/** Roughly a quarter megabyte. Above this it is re-encoded harder. */
const TARGET_BYTES = 280_000
/** Refused outright beyond this, rather than poisoning the backup. */
export const MAX_BYTES = 900_000

export const canTakePhoto = (): boolean => Capacitor.getPlatform() !== 'web'

export type BillSource = 'camera' | 'gallery'

/**
 * Take or choose a bill photo, already shrunk. Resolves null if the farmer
 * backs out, which is an ordinary thing to do and not an error.
 */
export async function captureBill(source: BillSource): Promise<string | null> {
  const photo = await Camera.getPhoto({
    source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    resultType: CameraResultType.DataUrl,
    quality: 55,
    width: 1280,
    // Corrects a slip photographed sideways, which is most of them.
    correctOrientation: true,
    allowEditing: false,
  })
  const dataUrl = photo.dataUrl
  if (!dataUrl) return null
  return shrinkToFit(dataUrl)
}

/**
 * Re-encode until it fits, or give up and return what we have.
 *
 * The camera's own `width` and `quality` do most of the work, but they are
 * hints — some devices ignore them, and a dense photograph of printed text
 * compresses badly. This is the backstop that keeps one bad shot from
 * breaking the backup.
 */
export async function shrinkToFit(dataUrl: string): Promise<string> {
  if (dataUrl.length <= TARGET_BYTES) return dataUrl

  let current = dataUrl
  for (const [maxEdge, quality] of [
    [1280, 0.5],
    [1000, 0.45],
    [800, 0.4],
  ] as const) {
    try {
      current = await redraw(current, maxEdge, quality)
    } catch {
      // A canvas that will not draw is not a reason to lose the bill.
      return current
    }
    if (current.length <= TARGET_BYTES) break
  }
  return current
}

/** One pass through a canvas at a smaller size and a lower quality. */
function redraw(dataUrl: string, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('no canvas'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('bad image'))
    img.src = dataUrl
  })
}

/** Roughly how many bytes a data URL costs once stored. */
export const approxBytes = (dataUrl: string): number =>
  Math.round((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75)
