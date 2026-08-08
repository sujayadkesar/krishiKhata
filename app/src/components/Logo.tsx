import {
  LOGO_COLORS, LOGO_PATHS, LOGO_TILE_RADIUS, LOGO_VIEWBOX,
  RULE_STROKE, RUPEE_SCALE, RUPEE_STROKE, RUPEE_TRANSLATE, STEM_STROKE,
} from './logoArt'

/**
 * The Krishi Khata mark: a sprout rising out of an open ledger, with a rupee
 * where the two meet.
 *
 * The paths come from `logoArt.ts` so that this, the printed letterhead, the
 * favicon and the Android launcher icon are all literally the same artwork.
 * See that file for why.
 *
 * `tone="mono"` is the statement version — one ink, no background tile.
 */

interface LogoProps {
  size?: number
  tone?: 'colour' | 'mono'
  /** Drop the rounded background tile — for placing on an existing surface. */
  bare?: boolean
  className?: string
  title?: string
}

export function Logo({ size = 40, tone = 'colour', bare = false, className, title }: LogoProps) {
  const mono = tone === 'mono'
  const c = LOGO_COLORS
  const ink = mono ? 'currentColor' : null

  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {!bare && !mono ? (
        <rect width="64" height="64" rx={LOGO_TILE_RADIUS} fill={c.tile} />
      ) : null}

      {mono ? (
        <>
          {/* Flattened to one ink: the leaves lead, the ledger is outlined,
              and the page shading is dropped rather than left as a grey that
              a cheap printer turns into a smudge. */}
          <path d={LOGO_PATHS.leafBack} fill="currentColor" opacity={0.55} />
          <path d={LOGO_PATHS.leafFront} fill="currentColor" />
          <path
            d={LOGO_PATHS.stem}
            stroke="currentColor"
            strokeWidth={STEM_STROKE}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={LOGO_PATHS.coverLeft}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <path
            d={LOGO_PATHS.coverRight}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <path d={LOGO_PATHS.coin} fill="#fff" stroke="currentColor" strokeWidth={1.6} />
        </>
      ) : (
        <>
          {/* Ledger first, so the sprout and the coin sit on top of it. */}
          <path d={LOGO_PATHS.coverLeft} fill={c.cover} />
          <path d={LOGO_PATHS.coverRight} fill={c.coverShade} />
          <path d={LOGO_PATHS.pageLeft} fill={c.page} />
          <path d={LOGO_PATHS.pageRight} fill={c.pageShade} />
          <path
            d={LOGO_PATHS.rules}
            stroke={c.rule}
            strokeWidth={RULE_STROKE}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={LOGO_PATHS.stem}
            stroke={c.stem}
            strokeWidth={STEM_STROKE}
            strokeLinecap="round"
            fill="none"
          />
          <path d={LOGO_PATHS.leafBack} fill={c.leafBack} />
          <path d={LOGO_PATHS.leafFront} fill={c.leafFront} />
          <path d={LOGO_PATHS.coin} fill={c.coin} />
        </>
      )}

      <g
        transform={`translate(${RUPEE_TRANSLATE.x} ${RUPEE_TRANSLATE.y}) scale(${RUPEE_SCALE})`}
      >
        <path
          d={LOGO_PATHS.rupee}
          fill="none"
          stroke={ink ?? c.ink}
          strokeWidth={RUPEE_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
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
  lang?: 'kn' | 'en' | 'both'
}) {
  // The wordmark always shows both names stacked, so 'both' needs no special
  // case — it only decides which one leads.
  const knLeads = lang !== 'en'
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logo size={size} tone={tone} />
      <span className="leading-none">
        <span className="block font-semibold" style={{ fontSize: size * 0.5 }}>
          {knLeads ? 'ಕೃಷಿ ಖಾತೆ' : 'Krishi Khata'}
        </span>
        <span className="block" style={{ fontSize: size * 0.3, color: 'var(--text-faint)' }}>
          {knLeads ? 'Krishi Khata' : 'ಕೃಷಿ ಖಾತೆ'}
        </span>
      </span>
    </span>
  )
}
