-- Live updates: every write to a table the dashboard shows sends
-- pg_notify('table_changes', <table>). The backend LISTENs and pushes the
-- matching RTK Query tags to the UI over Server-Sent Events (/api/events).
-- Statement-level, and Postgres folds identical notifications within a
-- transaction, so a bulk write is one event.

create or replace function notify_table_change() returns trigger
language plpgsql as $$
begin
  perform pg_notify('table_changes', tg_table_name);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'coaches', 'clients', 'calls', 'call_summaries', 'reports',
    'jobs', 'integration_outbox', 'mock_grain_recordings'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete or truncate on %I
         for each statement execute function notify_table_change()',
      t || '_notify_change', t
    );
  end loop;
end;
$$;
