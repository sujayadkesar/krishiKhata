/**
 * Schema and migrations.
 *
 * Each entry in MIGRATIONS moves the database forward by exactly one version
 * and is applied inside a transaction. `PRAGMA user_version` records where a
 * given phone has got to, so a farmer who skips three app updates still lands
 * on the current schema in order.
 *
 * MIGRATIONS IS APPEND-ONLY. Never edit a statement that has shipped — a phone
 * that already ran it will not run it again, and the two devices then disagree
 * about what the table looks like. Add a new migration instead.
 */

export const SCHEMA_VERSION = 5

const V1 = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id                    TEXT PRIMARY KEY,
  name_en               TEXT NOT NULL,
  name_kn               TEXT NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('cash','bank','upi')),
  opening_balance_paise INTEGER NOT NULL DEFAULT 0,
  bank_name             TEXT,
  account_last4         TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
  id              TEXT PRIMARY KEY,
  name_en         TEXT NOT NULL,
  name_kn         TEXT NOT NULL,
  short_en        TEXT NOT NULL,
  short_kn        TEXT NOT NULL,
  allows_fraction INTEGER NOT NULL DEFAULT 1,
  is_active       INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS heads (
  id         TEXT PRIMARY KEY,
  name_en    TEXT NOT NULL,
  name_kn    TEXT NOT NULL,
  used_for   TEXT NOT NULL CHECK (used_for IN ('income','expense','both')),
  color      TEXT NOT NULL DEFAULT 'green',
  icon       TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS head_units (
  head_id    TEXT NOT NULL REFERENCES heads(id),
  unit_id    TEXT NOT NULL REFERENCES units(id),
  is_default INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (head_id, unit_id)
);

CREATE TABLE IF NOT EXISTS sub_heads (
  id         TEXT PRIMARY KEY,
  name_en    TEXT NOT NULL,
  name_kn    TEXT NOT NULL,
  is_labour  INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,
  name_en     TEXT NOT NULL,
  name_kn     TEXT NOT NULL,
  sub_head_id TEXT REFERENCES sub_heads(id),
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS labourers (
  id                  TEXT PRIMARY KEY,
  name_en             TEXT NOT NULL,
  name_kn             TEXT NOT NULL,
  phone               TEXT,
  village             TEXT,
  is_group_lead       INTEGER NOT NULL DEFAULT 0,
  daily_rate_paise    INTEGER NOT NULL DEFAULT 0,
  half_day_rate_paise INTEGER,
  typical_group_size  INTEGER,
  note                TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id                TEXT PRIMARY KEY,
  kind              TEXT NOT NULL CHECK (kind IN ('income','expense','transfer')),
  date              TEXT NOT NULL,
  head_id           TEXT REFERENCES heads(id),
  sub_head_id       TEXT REFERENCES sub_heads(id),
  activity_id       TEXT REFERENCES activities(id),
  account_id        TEXT REFERENCES accounts(id),
  to_account_id     TEXT REFERENCES accounts(id),
  quantity_milli    INTEGER,
  unit_id           TEXT REFERENCES units(id),
  rate_paise        INTEGER,
  amount_paise      INTEGER NOT NULL,
  party_name        TEXT,
  note              TEXT,
  photo_id          TEXT,
  labour_payment_id TEXT,
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_date      ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_kind_date ON entries(kind, date);
CREATE INDEX IF NOT EXISTS idx_entries_head      ON entries(head_id);
CREATE INDEX IF NOT EXISTS idx_entries_account   ON entries(account_id);

CREATE TABLE IF NOT EXISTS photos (
  id         TEXT PRIMARY KEY,
  entry_id   TEXT,
  data       TEXT NOT NULL,
  bytes      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_sessions (
  id          TEXT PRIMARY KEY,
  head_id     TEXT REFERENCES heads(id),
  activity_id TEXT REFERENCES activities(id),
  sub_head_id TEXT REFERENCES sub_heads(id),
  note        TEXT,
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id              TEXT PRIMARY KEY,
  work_session_id TEXT NOT NULL REFERENCES work_sessions(id),
  labourer_id     TEXT NOT NULL REFERENCES labourers(id),
  date            TEXT NOT NULL,
  is_group        INTEGER NOT NULL DEFAULT 0,
  group_size      INTEGER NOT NULL DEFAULT 1,
  member_names    TEXT,
  day_fraction    INTEGER NOT NULL DEFAULT 1000,
  rate_paise      INTEGER NOT NULL,
  amount_paise    INTEGER NOT NULL,
  head_id         TEXT REFERENCES heads(id),
  activity_id     TEXT REFERENCES activities(id),
  note            TEXT,
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_att_labourer_date ON attendance(labourer_id, date);
CREATE INDEX IF NOT EXISTS idx_att_date          ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_att_session       ON attendance(work_session_id);
CREATE INDEX IF NOT EXISTS idx_att_head          ON attendance(head_id);

CREATE TABLE IF NOT EXISTS labour_payments (
  id           TEXT PRIMARY KEY,
  labourer_id  TEXT NOT NULL REFERENCES labourers(id),
  date         TEXT NOT NULL,
  account_id   TEXT NOT NULL REFERENCES accounts(id),
  amount_paise INTEGER NOT NULL,
  mode         TEXT NOT NULL CHECK (mode IN ('cash','upi','bank')),
  is_advance   INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  entry_id     TEXT REFERENCES entries(id),
  is_deleted   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_labourer_date ON labour_payments(labourer_id, date);
CREATE INDEX IF NOT EXISTS idx_pay_date          ON labour_payments(date);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id            TEXT PRIMARY KEY,
  payment_id    TEXT NOT NULL REFERENCES labour_payments(id),
  attendance_id TEXT NOT NULL REFERENCES attendance(id),
  amount_paise  INTEGER NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alloc_payment    ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_alloc_attendance ON payment_allocations(attendance_id);

CREATE TABLE IF NOT EXISTS change_log (
  id         TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id     TEXT NOT NULL,
  action     TEXT NOT NULL,
  summary    TEXT,
  at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_changelog_at ON change_log(at);
`

/**
 * Money can move BACK from a labourer.
 *
 * A farmhand who took an advance sometimes repays it in cash rather than
 * working it off, and the khata has to show that. Without a direction, the
 * only way to record it would be a second, negative payment, which makes every
 * balance query carry a sign convention it can get wrong.
 *
 * 'out' — the farm paid the labourer (wages or an advance).
 * 'in'  — the labourer handed money back.
 */
const V2 = `
ALTER TABLE labour_payments ADD COLUMN direction TEXT NOT NULL DEFAULT 'out';

CREATE INDEX IF NOT EXISTS idx_pay_direction ON labour_payments(labourer_id, direction);
`

/**
 * Two things the first cut got wrong about how a farm actually works.
 *
 * A CREW IS NOT INTERCHANGEABLE PEOPLE. "Ten labourers" is really six men and
 * four women, paid at different day rates, and a single head-count times a
 * single rate cannot express that. The counts and both rates are stored per
 * attendance row, snapshotted like every other rate.
 *
 * A CROP IS SOLD IN GRADES. Banana goes out as first class and second class at
 * different prices on the same day. Sub-heads were expense-only and global;
 * they now carry an optional head and a direction, so "First class" can belong
 * to Banana on the income side while "Fertilizer" stays global on the expense
 * side. group_size stays as the total so every existing row and query keeps
 * working.
 */
const V3 = `
ALTER TABLE attendance ADD COLUMN male_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN female_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN male_rate_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN female_rate_paise INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sub_heads ADD COLUMN head_id TEXT REFERENCES heads(id);
ALTER TABLE sub_heads ADD COLUMN used_for TEXT NOT NULL DEFAULT 'expense';

ALTER TABLE labourers ADD COLUMN female_rate_paise INTEGER;

CREATE INDEX IF NOT EXISTS idx_subhead_head ON sub_heads(head_id, used_for);

-- Existing rows are all-male crews at the rate they were entered with, which
-- is exactly what they meant before genders existed.
UPDATE attendance SET male_count = group_size, male_rate_paise = rate_paise
 WHERE male_count = 0 AND female_count = 0;
`

/**
 * A short worker code — W001, W002.
 *
 * Two people called Ramesha in one village is the normal case, and a UUID is
 * not something anyone can say out loud. A short code is searchable, fits on a
 * statement, and settles which Ramesha is meant without anybody having to
 * describe him.
 *
 * Backfilled by creation order, using a correlated count rather than a window
 * function so it works on whatever SQLite the phone happens to have.
 */
const V4 = `
ALTER TABLE labourers ADD COLUMN code TEXT;

UPDATE labourers
   SET code = 'W' || substr('000' ||
       (SELECT COUNT(*) FROM labourers l2 WHERE l2.created_at <= labourers.created_at), -3)
 WHERE code IS NULL;

CREATE INDEX IF NOT EXISTS idx_labourer_code ON labourers(code);
`

/**
 * A farm is not one piece of land.
 *
 * Most growers here work two or three separate plots — an inherited one, a
 * bought one, a leased one — and "did the Hosatota land pay for itself" is a
 * question the app could not answer at all, because everything was aggregated
 * to the farm. Crop alone does not substitute: the same banana grows on both
 * plots, and it is the plots that differ in water, soil and rent.
 *
 * Nullable everywhere on purpose. A farmer with one plot should never be made
 * to pick it, and every record made before this migration genuinely has no
 * plot — filling one in would be inventing data. Reports show those as
 * "Not recorded" rather than silently folding them into the first plot.
 *
 * Area is integer milli-units of `area_unit`, matching lib/quantity: 2.5 acre
 * is 2500. Acres and guntas are both in daily use and neither converts cleanly
 * for every district, so the unit is stored beside the number rather than
 * normalised to one of them.
 */
const V5 = `
CREATE TABLE IF NOT EXISTS plots (
  id          TEXT PRIMARY KEY,
  name_en     TEXT NOT NULL,
  name_kn     TEXT NOT NULL,
  survey_no   TEXT,
  area_milli  INTEGER,
  area_unit   TEXT,
  village     TEXT,
  note        TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

ALTER TABLE entries       ADD COLUMN plot_id TEXT REFERENCES plots(id);
ALTER TABLE work_sessions ADD COLUMN plot_id TEXT REFERENCES plots(id);
ALTER TABLE attendance    ADD COLUMN plot_id TEXT REFERENCES plots(id);

CREATE INDEX IF NOT EXISTS idx_entries_plot ON entries(plot_id);
CREATE INDEX IF NOT EXISTS idx_att_plot     ON attendance(plot_id);
`

/** Index in this array + 1 is the version it produces. Append only. */
export const MIGRATIONS: string[] = [V1, V2, V3, V4, V5]
