-- Weekly reports (Phase 3) and the mock integration outbox

-- A coach with no calls in the week gets an 'empty' report without an LLM call
alter table reports
  add column status text not null default 'ready'
    check (status in ('ready', 'empty'));
alter table reports add column drive_url text;

-- Run state: weekly_reports, coach_report and manager_report jobs share a runId
create index jobs_run_id_idx on jobs ((payload->>'runId'));

-- Everything the mock Slack and Drive connectors "sent" or "saved"
create table integration_outbox (
  id               uuid primary key default gen_random_uuid(),
  service          text not null check (service in ('slack', 'drive')),
  target           text not null,  -- Slack channel/user ID or Drive folder path
  title            text not null,  -- Slack fallback text or Drive document title
  payload          jsonb not null, -- Slack {text, blocks} or Drive {html}
  external_id      text not null,  -- fake Slack ts or Drive file ID
  idempotency_key  text unique,
  created_at       timestamptz not null default now()
);
create index integration_outbox_service_idx
  on integration_outbox (service, created_at desc);
create index integration_outbox_external_id_idx
  on integration_outbox (service, external_id);
