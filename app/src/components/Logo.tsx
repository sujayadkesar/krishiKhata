/**
 * The Krishi Khata mark: a sprout growing out of an open ledger.
 *
 * Drawn with few, large shapes on purpose. It has to survive being a 48 px
 * launcher icon and a one-colour letterhead print, and detail that reads on a
 * design canvas turns to mud at both of those sizes.
 *
 * `tone="mono"` is the statement version — one ink, no background — because a
 * dark green tile printed at the top of every page wastes toner and looks
 * cheap on the cheap paper these get printed on.
 */

interface LogoProps {
  size?: number
  tone?: 'colour' | 'mono'
  /** Drop the rounded background tile — for placing on an existing surface. */
  bare?: boolean
  className?: string
  title?: string
}

export function Logo({
  size = 40,
  tone = 'colour',
  bare = false,
  className,
  title,
}: LogoProps) {
  const mono = tone === 'mono'

  const ink = mono ? 'currentColor' : undefined
  const page = mono ? 'none' : '#ffffff'
  const pageShade = mono ? 'none' : '#d6e6dc'
  const leafFront = mono ? 'currentColor' : '#6dbd92'
  const leafBack = mono ? 'currentColor' : '#a7d9bc'
  const stem = mono ? 'currentColor' : '#f0c078'

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {!bare && !mono ? <rect width="64" height="64" rx="15" fill="#12502c" /> : null}

      {/* Stem first, so the leaves and the page overlap it cleanly. */}
      <path
        d="M32 45V24"
        stroke={stem}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Back leaf, reaching right. */}
      <path
        d="M33 31c0-6 4.6-11 11-11 0 6-4.6 11-11 11Z"
        fill={leafBack}
        opacity={mono ? 0.55 : 1}
      />
      {/* Front leaf, reaching left and slightly lower. */}
      <path
        d="M31 35c0-6.4-4.9-11.6-11.6-11.6 0 6.4 4.9 11.6 11.6 11.6Z"
        fill={leafFront}
      />

      {/* The open ledger the sprout comes out of. */}
      <path
        d="M32 44c-5.6-4-13.4-4.6-20-2.6v13c6.6-2 14.4-1.4 20 2.6Z"
        fill={page}
        stroke={ink}
        strokeWidth={mono ? 2.4 : 0}
        strokeLinejoin="round"
      />
      <path
        d="M32 44c5.6-4 13.4-4.6 20-2.6v13c-6.6-2-14.4-1.4-20 2.6Z"
        fill={pageShade}
        stroke={ink}
        strokeWidth={mono ? 2.4 : 0}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Logo plus the name, for headers and the letterhead. */
export function Wordmark({
  size = 34,
  tone = 'colour',
  lang = 'kn',
}: {
  size?: number
  tone?: 'colour' | 'mono'
  lang?: 'kn' | 'en'
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logo size={size} tone={tone} />
      <span className="leading-none">
        <span className="block font-semibold" style={{ fontSize: size * 0.5 }}>
          {lang === 'kn' ? 'ಕೃಷಿ ಖಾತೆ' : 'Krishi Khata'}
        </span>
        <span
          className="block"
          style={{ fontSize: size * 0.3, color: 'var(--text-faint)' }}
        >
          {lang === 'kn' ? 'Krishi Khata' : 'ಕೃಷಿ ಖಾತೆ'}
        </span>
      </span>
    </span>
  )
}
