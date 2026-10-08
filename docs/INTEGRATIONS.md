# Integrations: Mock Today, Live Later

The demo runs with **mocked** Grain, Slack and Google Drive, so it costs nothing. This document describes how each one would be integrated for real. Everything outside the three connectors (queue, matching, LLM, reports, idempotency) already works as it would in production and doesn't change.

## How the swap works

Each service sits behind a small interface with a `mock` and a `live` implementation, selected by an env var. The pipeline only ever calls the interface.

| Service | Interface | Selector | Mock behavior |
| --- | --- | --- | --- |
| Grain | `GrainConnector` (`backend/src/services/grain/grainConnector.ts`): `fetchRecording(id)`, `listRecordings(since)` | `GRAIN_MODE=mock\|live` | Serves sample transcripts; **Simulate call / week** sends webhooks to our own endpoint |
| Slack | `SlackConnector` (`backend/src/services/slack/`): `postMessage(msg)`, `updateMessage(channel, ts, msg)`, `openDm(userId)` | `SLACK_MODE=mock\|live` | Writes the Block Kit message to `integration_outbox`, returns a fake `ts` |
| Drive | `DriveConnector` (`backend/src/services/drive/`): `saveDocument(folderPath, title, html, key)` | `DRIVE_MODE=mock\|live` | Writes the HTML to `integration_outbox`, returns a fake file ID and a dashboard URL |

Going live for one service means:

1. Write its `live` implementation.
2. Add secrets to `.env`.
3. Flip the selector.
4. Run the rollout checklist at the end of this document.

The mock stays available for local development and demos.

Error handling is already shared. Connectors throw:

- `RetryLaterError(delayMs)` for 429 responses and "not ready yet"
- `NonRetryableError` for configuration problems such as a bad channel or a revoked token; these dead-letter the job and raise an ops alert
- a plain `Error` for transient failures, which the queue backs off and retries

---

## Grain

**What it does in the app:** delivers each recorded call (metadata, participants and transcript) without anyone uploading anything.

### Live design

```
Grain ── webhook "recording added" ──▶ POST /webhooks/grain
                                         │ verify → enqueue ingest_grain_recording {recordingId}
                                         ▼
                              worker: GrainConnector.fetchRecording(id)
                                         │ GET recording + transcript from the Grain API
                                         ▼
                              insertCall (unique grain_recording_id) → process_call
nightly 02:00 CT: listRecordings(last 48h) → enqueue any id we don't have
```

- **Auth:** a Grain API token for a workspace admin account, stored as `GRAIN_API_TOKEN` and sent as `Authorization: Bearer`.
- **Webhook registration:** a one-time setup script (`npm run grain:register-webhook`) that registers `https://<host>/webhooks/grain` for new recordings.
- **Don't trust the payload:** the webhook is used only for the recording ID. Everything else is fetched again from the API with our token. A forged webhook can at most make us fetch a real recording we would have fetched anyway. Two protections:
  - If Grain signs webhooks, verify the signature in `webhookSignature.ts`. This is the only file that changes.
  - If it doesn't, put an unguessable secret in the URL path (`/webhooks/grain/<token>`).
- **Transcript not ready:** Grain can announce a recording before the transcript is finished. If the transcript is missing or still processing, `fetchRecording` throws `RetryLaterError(2 min)`. The job's 5 attempts with backoff cover about 30 minutes; raise `max_attempts` for this job type if that's too short.
- **Mapping to `IncomingCall`:**
  - `externalId` is the Grain recording ID.
  - `title`, `startedAt` and `durationSeconds` come from the recording.
  - `participants` come from the recording's attendee list with emails, which drives coach/client matching.
  - `transcript` is speaker-labelled text, `Name: utterance` per line, the same as the samples.
  - Keep the raw API response in `raw_payload` for debugging.
- **Missing participant emails** (external guests, or a recording started without a calendar event): matching falls back to the title-keyword rule, then to the review queue. A call is never posted to a guessed channel.
- **Reconcile:** a nightly cron calls `listRecordings(since: now - 48h)`, paginates, and enqueues `ingest_grain_recording` for each ID. The existing idempotency key `grain:<id>` makes this a no-op for recordings we already have. This covers webhooks that Grain dropped or that hit us during a deploy.
- **Rate limits:** treat `429` and `Retry-After` the same way as Slack does. The volume is tiny (50+ calls a week plus one nightly list).

**To verify against Grain's current docs before building:** the exact endpoints, the webhook event name and payload, whether webhooks are signed, the transcript format, whether attendee emails are included, and **which Grain plan includes API and webhook access**. This is the one integration that probably needs a paid tier. If the API isn't available on the business's plan, a fallback is Grain's Zapier or Make integration: it POSTs to our webhook with the recording ID or transcript, and we skip the API fetch.

**Estimate:** about 1 day, including the reconcile job and tests against recorded API responses.

---

## Slack

**What it does in the app:** posts each call summary to the client's channel, sends weekly coach reports as DMs, sends the manager report to a managers channel, and sends ops alerts to an ops channel.

### Live design

- **App setup:** create a Slack app in the business workspace and install it. It gets a bot token (`xoxb-…`, stored as `SLACK_BOT_TOKEN`) with these scopes:

  | Scope | Why |
  | --- | --- |
  | `chat:write` | Post and update messages |
  | `chat:write.public` | Post to public client channels without joining each one |
  | `im:write` | Open DMs to coaches for their weekly report |
  | `users:read`, `users:read.email` | Resolve a coach's Slack user ID from their email (`users.lookupByEmail`), so `coaches.slack_user_id` can fill itself |
  | `channels:read`, `groups:read` | List channels for the client channel picker (`conversations.list`) and check a channel before saving it (`conversations.info`). Without `groups:read`, only public channels are listed |
  | `channels:join` | Have the bot join a public client channel by itself when the channel is chosen (`conversations.join`) |

  After adding scopes, reinstall the app to the workspace.

  **Picking a client's channel:** in the review queue ("+ New client…") or on the client page ("Change"), choose a channel from the list or paste its ID. The backend checks the channel before saving. **Public channels:** the bot joins on save. **Private channels:** Slack won't let a bot join by itself, so someone runs `/invite @Coaching Bot` in the channel first, then clicks Refresh. Until then, the backend rejects the ID as not found. If a channel later stops working, posting fails with `not_in_channel`, which is non-retryable and raises an alert telling ops to invite the bot.
- **Calls:**
  - `chat.postMessage` (already implemented in today's `slackClient.ts`; it becomes the live `SlackConnector`).
  - `conversations.open` for coach DMs.
  - `chat.update` when a report is regenerated. The stored `ts` lets the message be edited rather than posted twice.
- **Idempotency:** unchanged. A stored `slack_message_ts` on the call or report means the message is never posted again. A crash between Slack accepting the post and our DB write could, in rare cases, cause one duplicate. That's acceptable at this volume. To close the gap, set `metadata.event_payload.call_id` on each message and check recent channel history before posting again.
- **Rate limits:** `chat.postMessage` allows about one message per second per channel, with short bursts. `slackClient.ts` already honors `429 Retry-After`, sleeping in-process for short waits and handing longer ones back to the queue. 50+ calls a week is far below the limit; the Monday report burst of about 10 messages is also fine.
- **Limits to respect:** 50 blocks per message, 3000 characters per section, 150 per header. `summaryBlocks.ts` already clips. Long reports link to the Drive document instead of inlining everything.
- **Channel mapping:** `clients.slack_channel_id` holds the channel ID (not the name, since names change). The channel picker (`GET /api/slack/channels`, `services/slack/slackChannels.ts`) shows names and saves IDs.

**Cost:** posting with a bot works on Slack's **free plan**, which limits message history and the number of installed apps. A free test workspace is enough to try this before using the business workspace.

**Estimate:** about half a day; most of the code already exists.

---

## Google Drive

**What it does in the app:** archives every call summary and every weekly report as a Google Doc, so nobody moves files by hand.

### Folder layout

```
<Coaching root>/
  Calls/<Client name>/<YYYY-MM>/<YYYY-MM-DD> <Call title>   (per-call summary)
  Weekly reports/<YYYY-MM-DD>/<Coach name>                 (coach report)
  Weekly reports/<YYYY-MM-DD>/Manager overview             (manager report)
```

### Setup (implemented: `DRIVE_MODE=live`)

The live connector is `backend/src/services/drive/` (`driveAuth.ts` for credentials, `driveApi.ts` for REST, `driveConnector.ts` for folders and idempotency). `npm run drive:setup` checks everything and uploads a "Setup check" doc.

**Personal Google account (OAuth):**

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. Set up the **OAuth consent screen**: External, add your account as a test user, scope `.../auth/drive.file`. Then **Publish app** (to "In production"). In "Testing" status, refresh tokens expire after 7 days. `drive.file` is a non-sensitive scope, so publishing needs no Google verification.
3. Under **Credentials**, create an OAuth client ID of type **Desktop app**. Put its ID and secret in `backend/.env` as `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
4. Run `cd backend && npm run drive:setup`. Open the printed URL and allow access. The script creates a "Coaching Call Intelligence" folder in My Drive and prints `GOOGLE_OAUTH_REFRESH_TOKEN` and `DRIVE_ROOT_FOLDER_ID`.
5. Add those values and `DRIVE_MODE=live` to `backend/.env`, then restart the backend.

**Google Workspace (service account + Shared Drive):**

1. Enable the Drive API as above. Create a **service account** and a JSON key.
2. Add the service account's email as **Content manager** of a Shared Drive. Create a root folder there and copy its ID from the URL.
3. In `backend/.env`, set `GOOGLE_SERVICE_ACCOUNT_JSON` (the key JSON on one line, or the path to the key file) and `DRIVE_ROOT_FOLDER_ID`. Run `npm run drive:setup`, then set `DRIVE_MODE=live`.

Calls and reports archived before the switch keep their mock outbox documents. Only new saves go to Drive.

### Live design

- **Auth.** Two options, depending on the business's Google setup:

  | Setup | Auth | Notes |
  | --- | --- | --- |
  | **Google Workspace (recommended)** | A **service account** added as *Content manager* to a **Shared Drive**; key JSON in `GOOGLE_SERVICE_ACCOUNT_JSON` | Files belong to the business, not to a person or the bot. Service accounts have no storage of their own, so they **must** write into a Shared Drive |
  | Personal Google account | OAuth for one admin user (scope `drive.file`); a refresh token in `GOOGLE_OAUTH_REFRESH_TOKEN` | Works on a free account. Files are owned by that user and stop updating if they revoke access |

- **API (REST over `fetch`; `google-auth-library` only for tokens):**
  - **Find or create a folder:** `GET /drive/v3/files` with `q: name='…' and '<parentId>' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`. If nothing is found, `POST /drive/v3/files` with the folder mimeType. Resolved folder IDs are cached in memory per process, so a restart costs one lookup per folder.
  - **Create a document:** `POST /upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`. The metadata is `{ name, parents: [folderId], mimeType: 'application/vnd.google-apps.document', appProperties: { key } }` and the body is the rendered HTML. Drive converts it to a Google Doc, keeping headings, lists and tables.
  - **Regenerated report:** `PATCH /upload/drive/v3/files/<id>?uploadType=multipart` replaces the content (and title) in place, so the link in Slack stays valid.
- **Idempotency:**
  - A stored `drive_file_id` means the document isn't created again.
  - To survive a crash between upload and DB write, each file carries `appProperties.key` (`call:<id>` or `report:<id>`). Before creating, query `appProperties has { key='key' and value='…' }` and reuse any match.
- **Errors:**
  - Revoked or expired credentials (`invalid_grant`): `NonRetryableError` telling ops to rerun `drive:setup`. A `401` with a fresh token is retried with backoff.
  - `403 rateLimitExceeded`, `403 userRateLimitExceeded` or `429`: `RetryLaterError` with backoff.
  - `403 storageQuotaExceeded` (a service account writing outside a Shared Drive) or `404` on the root folder: `NonRetryableError` and an alert.
- **Ordering:** the Drive archive runs **after** Slack in its own step. A Drive outage never delays the summary reaching the client channel.

**Cost:** the Drive API itself is free; you only need a Google Cloud project, and no billing account is required for Drive. Shared Drives need Google Workspace, which the business probably already has.

**Estimate:** about 1 day, including the folder cache and HTML rendering.

---

## Secrets and config (live)

| Variable | Service |
| --- | --- |
| `GRAIN_MODE=live`, `GRAIN_API_TOKEN`, `GRAIN_WEBHOOK_SECRET` | Grain |
| `SLACK_MODE=live`, `SLACK_BOT_TOKEN`, `SLACK_MANAGER_CHANNEL_ID`, `SLACK_OPS_CHANNEL_ID` | Slack |
| `DRIVE_MODE=live`, `GOOGLE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_OAUTH_*`), `DRIVE_ROOT_FOLDER_ID` | Drive |

Secrets belong in the host's secret store, not in the repo. `/health` reports each connector's mode and whether its credentials work (`auth.test` for Slack, `about.get` for Drive, a cheap list call for Grain) without exposing the values.

## Rollout checklist (per service)

1. **Sandbox first:** a free Slack test workspace, a test Shared Drive folder, and one Grain test recording.
2. **Shadow mode:** for the first week, send everything to a single test channel and folder (`*_OVERRIDE_TARGET` env vars). Compare it against the mock outbox output.
3. **Backfill:** run the reconcile over the last 7 days to load existing recordings.
4. **Go live:** remove the override. Watch the ops channel for alerts during the first Monday report run.
5. **SOP:** each alert type (bot not in channel, Drive quota, unmatched call, dead job) gets a one-line "what to do" entry in the README.
