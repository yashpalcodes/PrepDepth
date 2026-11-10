CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patterns (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  parent_id   BIGINT REFERENCES patterns(id) ON DELETE SET NULL,
  description TEXT
);

CREATE TABLE problems (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform    TEXT NOT NULL,
  external_id TEXT,
  title       TEXT NOT NULL,
  url         TEXT,
  difficulty  TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  UNIQUE (platform, external_id)
);

CREATE TABLE problem_patterns (
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  pattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, pattern_id)
);

-- One "card" per user per problem
CREATE TABLE user_problems (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id      BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  first_solved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  solve_minutes   INTEGER CHECK (solve_minutes >= 0),
  needed_hint     BOOLEAN NOT NULL DEFAULT false,
  ease            REAL NOT NULL DEFAULT 2.5,
  interval_days   REAL NOT NULL DEFAULT 0,
  repetitions     INTEGER NOT NULL DEFAULT 0,
  lapses          INTEGER NOT NULL DEFAULT 0,
  due_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  UNIQUE (user_id, problem_id)
);

CREATE INDEX idx_user_problems_due ON user_problems (user_id, due_at);

-- Append-only review history. Never update or delete rows here.
CREATE TABLE reviews (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_problem_id  BIGINT NOT NULL REFERENCES user_problems(id) ON DELETE CASCADE,
  reviewed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  rating           SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4),
  recall_minutes   INTEGER CHECK (recall_minutes >= 0),
  recalled_approach BOOLEAN
);

CREATE INDEX idx_reviews_card ON reviews (user_problem_id, reviewed_at);

CREATE TABLE notes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_problem_id BIGINT NOT NULL UNIQUE REFERENCES user_problems(id) ON DELETE CASCADE,
  approach_text   TEXT,
  key_insight     TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cached/derived mastery per pattern (filled in later phases)
CREATE TABLE pattern_stats (
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_id       BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  mastery          REAL NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, pattern_id)
);
