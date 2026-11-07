-- Migration number: 0001 	 Create the submissions table.
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'published', 'failed')),
  reasons TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX submissions_status_idx ON submissions (status);
