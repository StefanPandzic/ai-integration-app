# Operations SOP: Coaching Call Intelligence

The system runs on its own. Calls arrive from Grain, get summarized, go to the client's Slack channel and are saved to Google Drive. Weekly reports go out every Monday at 7:00 CT. **You don't need to check the dashboard.** When something needs a person, an alert is posted in the ops Slack channel (`SLACK_OPS_CHANNEL_ID`, default `#coaching-ops`; in the demo, the **Outbox** page). Each alert has a button that opens the screen where you fix it.

This page lists every alert, what it means and what to do.

## Alerts

### 🚨 Call needs review: "&lt;title&gt;"

**Meaning.** A call came in, but the system couldn't tell which client it belongs to. This happens when no participant email matches a client and no title keyword does either, or when more than one client matches. The summary was **not** posted anywhere, because posting to a guessed channel would be worse than waiting.

**Usual causes.** The client joined from a personal email. It's a new client who isn't in the directory yet. It was an intro or sales call.

**What to do.**
1. Press **Assign client**. The review queue opens with this call highlighted.
2. Pick the client. The coach defaults to the client's coach. The summary is generated and posted within a minute or two.
3. If the call isn't a client call (for example an internal meeting), leave it in the queue. Nothing is sent.
4. If the same client keeps landing here, ask an admin to add their other email or a title keyword to the client record.

### 🚨 Call summary failed: "&lt;title&gt;"

**Meaning.** The call was matched, but processing failed every time it was tried (5 attempts with increasing waits, or a single permanent error). The client's channel has **not** received the summary. The call shows as **Failed**.

**Usual causes.**

| Error contains | Cause | Fix |
| --- | --- | --- |
| `LLMOutputError`, `schema`, `owners are not call participants` | The model returned unusable output twice | Usually transient. Press Retry. If it fails again, check the transcript (very short or garbled?) |
| `fetch failed`, `ECONNREFUSED`, `Ollama`, `overloaded` | The LLM provider is down | Wait until it is back, then Retry |
| `Slack error: channel_not_found`, `not_in_channel` | The bot isn't in the client's channel, or the channel ID is wrong | Invite the bot, or fix `slack_channel_id`, then Retry |
| `Simulated failure (demo …)` | Demo switch "Fail next call" | Retry |

**What to do.** Fix the cause, then press **Open call** → **Retry**. Steps that already finished are not repeated: if Slack was already posted, only the Drive copy is retried.

### 🚨 Grain recording could not be fetched

**Meaning.** Grain told us about a recording, but we couldn't download it. The call isn't in the system yet.

**What to do.** Usually Grain was unavailable or the API key is wrong or expired. Once that's fixed, press **Retry** on the job in **Pipeline → Failures**. If you do nothing, the nightly reconcile picks the recording up again.

### 🚨 Weekly report job failed: coach_report / manager_report / weekly_reports

**Meaning.**
- **`coach_report`:** one coach's weekly report could not be built. The manager report still goes out and lists this coach under "missing coach reports".
- **`manager_report` or `weekly_reports`:** the manager overview didn't go out.

**What to do.** Read the error, fix the cause, then either:
- press **Retry** on the job in **Pipeline → Failures**. A retried coach report is delivered to that coach, but a manager overview that already went out is not rebuilt. Or:
- use **Reports → Rerun week** to regenerate and resend everything for that week, including the manager overview.

### 🚨 Weekly reports partial: N coach report(s) missing

**Meaning.** The manager report was delivered without some coaches, because their jobs failed. The alert names them.

**What to do.** Same as above: fix the cause, retry the dead coach jobs, or rerun the week. A rerun posts fresh reports.

### 🚨 Recovered N missed Grain recording(s)

**Meaning.** The nightly reconcile found recordings in Grain whose webhook never reached us. They are now being processed normally.

**What to do.** Nothing, for one or two. If it recovers many calls, or does so night after night, the Grain webhook is probably broken (wrong URL, a secret mismatch, or the server was down). Check the webhook settings in Grain and the server's uptime.

### 🚨 Job failed: &lt;type&gt;

Any other job that ran out of retries, for example `reconcile_grain`. Read the error, fix the cause, and press **Retry** in **Pipeline → Failures**.

## Tools

| Tool | Where | Use it for |
| --- | --- | --- |
| **Retry** | Call page, Pipeline → Failures | A dead job. It restarts with fresh attempts and resumes from the last finished step |
| **Assign client** | Review queue, call page | Calls that couldn't be matched |
| **Reconcile now** | Pipeline page | Recovering missed webhooks right away instead of waiting for the night |
| **Rerun week** | Reports page | Regenerating and resending a week's reports after a fix |
| `GET /health` | Uptime monitor | See below |

## Reading `/health`

```json
{
  "status": "ok",
  "database": "ok",
  "queue": { "depth": 0, "ready": 0, "running": 0, "dead": 0, "oldestReadyAgeSeconds": null },
  "lastReconcile": { "status": "succeeded", "updated_at": "…", "result": { "listed": 12, "recovered": 0 } },
  "lastReportRun": { "period_start": "2026-09-28", "state": "ok" },
  "nextRuns": { "reports": "…", "reconcile": "…" }
}
```

| Signal | Healthy | Investigate when |
| --- | --- | --- |
| HTTP status | 200 | 503: the database is unreachable and nothing is processed |
| `queue.dead` | 0 | Above 0: each one was alerted. Clear them from Pipeline → Failures |
| `queue.oldestReadyAgeSeconds` | Under a few minutes | Over 15 minutes: the worker is stuck or the server is overloaded. Restart the backend |
| `lastReconcile.status` | `succeeded`, within 24 h | `dead`, or older than a day: the reconcile cron isn't running |
| `lastReportRun.state` | `ok` | `partial` or `failed`: see the report alerts above |

## Logs

Every line logged while a job runs carries its job ID, plus the call ID or the report run ID. Set `LOG_FORMAT=json` in production and search by `callId` to follow one call from the webhook to Slack and Drive.
