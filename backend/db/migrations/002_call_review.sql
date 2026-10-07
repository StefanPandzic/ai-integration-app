-- Why a call landed in the review queue (status = 'needs_review')
alter table calls add column review_reason text;

-- Case-insensitive participant-email matching
create index clients_email_lower_idx on clients (lower(email));
create index coaches_email_lower_idx on coaches (lower(email));
