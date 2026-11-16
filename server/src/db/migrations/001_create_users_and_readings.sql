CREATE TABLE users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL CONSTRAINT users_name_nonblank CHECK (length(btrim(name)) > 0),
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL CONSTRAINT users_password_hash_nonblank CHECK (length(password_hash) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)) AND length(email) > 0)
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE readings (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  slot TEXT NOT NULL CONSTRAINT readings_slot_allowed CHECK (
    slot IN ('morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner')
  ),
  value_mg_dl SMALLINT NOT NULL CONSTRAINT readings_value_range CHECK (value_mg_dl BETWEEN 40 AND 600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT readings_user_date_slot_unique UNIQUE (user_id, reading_date, slot)
);

-- The unique index's (user_id, reading_date) prefix also serves daily/range lookups.
