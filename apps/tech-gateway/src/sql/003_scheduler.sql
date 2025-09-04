-- 003_scheduler.sql

-- People who can take appointments
CREATE TABLE IF NOT EXISTS techs (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Per-tech recurring availability (30-min blocks in local time)
-- day_of_week: 0=Sun ... 6=Sat
CREATE TABLE IF NOT EXISTS tech_availability (
  id            TEXT PRIMARY KEY,
  tech_id       TEXT NOT NULL REFERENCES techs(id),
  day_of_week   INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  start_minute  INTEGER NOT NULL,  -- minutes since 00:00 (e.g., 9:00 → 540)
  end_minute    INTEGER NOT NULL,  -- exclusive
  capacity      INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Optional blackout dates (shop closed / out-of-office)
CREATE TABLE IF NOT EXISTS blackout_days (
  id            TEXT PRIMARY KEY,
  date_ymd      TEXT NOT NULL,     -- 'YYYY-MM-DD'
  reason        TEXT
);

-- Appointments (state machine)
CREATE TABLE IF NOT EXISTS appointments (
  id            TEXT PRIMARY KEY,
  vehicle_id    INTEGER,           -- optional link when known
  owner_email   TEXT NOT NULL,
  tech_id       TEXT,              -- optional: assign to tech up front or later
  date_ymd      TEXT NOT NULL,     -- 'YYYY-MM-DD'
  start_minute  INTEGER NOT NULL,  -- minutes since midnight local time
  end_minute    INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending|confirmed|completed|cancelled|no_show
  notes         TEXT,
  gcal_event_id TEXT,              -- Google Calendar event id if synced
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Omneuro-visible event feed (append-only)
CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  ts            INTEGER NOT NULL,  -- unix ms
  actor         TEXT,              -- 'client:<email>' | 'system' | 'tech:<email>' | 'omneuro'
  type          TEXT NOT NULL,     -- 'vehicle.created' | 'appointment.created' | ...
  json          TEXT NOT NULL      -- event payload
);