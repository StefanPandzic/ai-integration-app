-- Coaching call intelligence: initial schema
-- Requires Postgres 15+ (Supabase) for UNIQUE NULLS NOT DISTINCT.

create extension if not exists pgcrypto;

create table coaches (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null unique,
  slack_user_id  text,
  created_at     timestamptz not null default now()
);

create table clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text unique,
  coach_id          uuid references coaches(id) on delete set null,
  slack_channel_id  text not null,
  -- Fallback matching: case-insensitive substrings of the call title
  title_keywords    text[] not null default '{}',
  created_at        timestamptz not null default now()
);
create index clients_coach_id_idx on clients (coach_id);

create table calls (
  id                  uuid primary key default gen_random_uuid(),
  grain_recording_id  text not null unique,  -- idempotency key for webhooks
  source              text not null default 'grain'
                        check (source in ('grain', 'mock', 'browser')),
  title               text,
  started_at          timestamptz,
  duration_seconds    integer,
  participants        jsonb not null default '[]',  -- [{name, email}]
  transcript          text not null,
  coach_id            uuid references coaches(id) on delete set null,
  client_id           uuid references clients(id) on delete set null,
  status              text not null default 'received'
                        check (status in ('received', 'needs_review', 'summarized',
                                          'posted', 'failed')),
  slack_message_ts    text,  -- set once posted; prevents double-posting on retry
  raw_payload         jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index calls_status_idx on calls (status);
create index calls_coach_started_idx on calls (coach_id, started_at);

create table call_summaries (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid not null unique references calls(id) on delete cascade,
  summary     jsonb not null,
  provider    text not null,
  model       text not null,
  created_at  timestamptz not null default now()
);

create table reports (
  id                uuid primary key default gen_random_uuid(),
  type              text not null check (type in ('coach', 'manager')),
  coach_id          uuid references coaches(id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  content           jsonb not null,
  provider          text not null,
  model             text not null,
  slack_message_ts  text,
  drive_file_id     text,
  created_at        timestamptz not null default now(),
  check ((type = 'coach') = (coach_id is not null)),
  unique nulls not distinct (type, coach_id, period_start)
);

create table jobs (
  id               uuid primary key default gen_random_uuid(),
  type             text not null,  -- e.g. 'summarize_call', 'post_slack', 'weekly_reports'
  payload          jsonb not null default '{}',
  call_id          uuid references calls(id) on delete cascade,  -- log correlation
  idempotency_key  text unique,
  status           text not null default 'pending'
                     check (status in ('pending', 'running', 'succeeded', 'failed', 'dead')),
  attempts         integer not null default 0,
  max_attempts     integer not null default 5,
  run_at           timestamptz not null default now(),
  locked_at        timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Worker claim query: status = 'pending' and run_at <= now() ... for update skip locked
create index jobs_claim_idx on jobs (run_at) where status = 'pending';
create index jobs_call_id_idx on jobs (call_id);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger calls_set_updated_at before update on calls
  for each row execute function set_updated_at();
create trigger jobs_set_updated_at before update on jobs
  for each row execute function set_updated_at();
