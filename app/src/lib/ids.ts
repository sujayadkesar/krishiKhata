/**
 * Row ids are UUIDs generated on the device.
 *
 * A monotonic counter would be smaller, but ids also have to survive a backup
 * being restored onto a second phone, and two devices that both allocated
 * "id 7" would silently merge two different labourers.
 */

export function newId(): string {
  const c = globalThis.crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()

  // Older Android WebViews have getRandomValues but not randomUUID.
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Seeded master data uses FIXED ids, so a restore onto a phone that has
 * already been used does not end up with two "Banana" heads splitting every
 * report between them.
 */
export function seedId(slug: string): string {
  const base = '00000000-0000-4000-8000-'
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return base + h.toString(16).padStart(12, '0')
}
