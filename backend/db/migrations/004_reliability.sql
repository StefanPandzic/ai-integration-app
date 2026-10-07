-- Reliability (Phase 4): mock Grain memory, per-call Drive archive, job feed

-- Every recording the mock Grain connector "has", whether or not its
-- webhook was delivered; the nightly reconcile lists from here
create table mock_grain_recordings (
  recording_id     text primary key,
  sample_id        text not null,
  started_at       timestamptz not null,
  webhook_dropped  boolean not null default false,
  created_at       timestamptz not null default now()
);
create index mock_grain_recordings_created_idx
  on mock_grain_recordings (created_at);

-- Drive copy of the call summary (set once saved; prevents a second upload)
alter table calls add column drive_file_id text;
alter table calls add column drive_url text;

-- Pipeline page: job feed and failures (newest first, by status)
create index jobs_status_updated_idx on jobs (status, updated_at desc);
create index jobs_updated_idx on jobs (updated_at desc);
