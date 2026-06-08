# Manus Reference Spike Guide

This guide is for a local feasibility spike only. It does not read from or write to the Posty database, does not consume `reference_analysis_jobs`, and does not implement the production queue processor or webhook.

## Purpose

Use one to three public Instagram Reel URLs to check whether Manus API v2 can extract enough information from links alone for Posty's reference analysis flow:

- access status and notes
- audio access status and notes
- transcript provenance and confidence
- transcript and visible captions
- viral factors
- business-use points
- content angles
- risk notes
- task-level credit usage

## Inputs

Pass one to three real public Reel URLs as CLI arguments. Start with one URL for the first smoke test so the first run uses the least possible credit.

Smoke test with one Reel:

```powershell
npx tsx scripts/manus-reference-spike.ts "https://www.instagram.com/reel/ACTUAL_SHORTCODE/"
```

After the first result looks useful, run a second pass with two more URLs:

```powershell
npx tsx scripts/manus-reference-spike.ts `
  "https://www.instagram.com/reel/ACTUAL_SHORTCODE_2/" `
  "https://www.instagram.com/reel/ACTUAL_SHORTCODE_3/"
```

Input validation without API calls:

```powershell
npx tsx scripts/manus-reference-spike.ts --validate-only "https://www.instagram.com/reel/ACTUAL_SHORTCODE/"
```

Dry-run the sanitized `task.create` payload shape before the first real call:

```powershell
npx tsx scripts/manus-reference-spike.ts --dry-run "https://www.instagram.com/reel/ACTUAL_SHORTCODE/"
```

Validate the runner path up to the fetch boundary without calling Manus:

```powershell
npx tsx scripts/manus-reference-spike.ts --validate-runner "https://www.instagram.com/reels/ACTUAL_SHORTCODE/"
```

Exercise the transient `Task not found` recovery path without calling Manus:

```powershell
npx tsx scripts/manus-reference-spike.ts --mock-transient-task-not-found "https://www.instagram.com/reels/ACTUAL_SHORTCODE/"
```

If zero URLs are passed, the script prints usage and exits without calling Manus. If four or more URLs are passed, the script fails before any API call. There are no default placeholder URLs that can be called accidentally.

Do not use production queue rows as input for this spike.

## Environment

Set `MANUS_API_KEY` in the current shell before running the script. The script reads it from `process.env.MANUS_API_KEY` and never prints the raw value.

`MANUS_PROJECT_ID` is optional. If it is set, the script sends it as `project_id` in `task.create`; otherwise the task is created without a project.

## task.create Payload Shape

The script sends the prompt as a plain string:

```json
{
  "message": {
    "content": "..."
  }
}
```

Manus API v2 also supports a ContentPart array, but text parts must include `type: "text"`. A payload like `{ "text": "..." }` without `type` can fail with `unsupported content part type: ""`. This spike avoids that class of error by using the plain string form.

## Audio Transcript Policy

The prompt asks Manus to check public Reel video/audio access before writing a transcript:

- If Reel audio is accessible, `transcript` should contain the actual spoken words as faithfully as possible.
- Visible on-screen captions and the post caption must stay separate from audio transcript.
- If audio is inaccessible or cannot be verified, `transcript` should be `null`.
- Audio access limitations should be recorded in `audio_access_status` and `audio_access_notes`.

Transcript provenance fields:

- `transcript_source='audio'`: actual speech-based transcript.
- `transcript_source='visible_captions'`: visible text from the Reel screen; do not assume it is identical to speech.
- `transcript_source='post_caption'`: Instagram post caption text; do not treat it as spoken script.
- `transcript_source='mixed'`: mixed sources were used and should be reviewed carefully.
- `transcript_source='unavailable'`: speech transcript could not be confirmed.

`transcript=null` means the link-based run could not confirm an audio transcript. It does not mean Manus lacks audio analysis capability.

## Manus API v2 Endpoints

- `POST https://api.manus.ai/v2/task.create`
- `GET https://api.manus.ai/v2/task.detail`
- `GET https://api.manus.ai/v2/task.listMessages`
- `GET https://api.manus.ai/v2/usage.list`

The script authenticates with the `x-manus-api-key` header.

## Polling

After `task.create` returns a `task_id`, the script waits 3 seconds before the first `task.listMessages` call. Then it polls `task.listMessages` every 10 seconds for up to 90 attempts. That is a maximum wait of about 15 minutes per task. The interval is intentionally above 3 seconds to avoid a tight loop.

If `task.listMessages` returns HTTP 404 or `Task not found` during the first 30 seconds after polling starts, the script treats it as transient propagation delay instead of final failure. It retries with short delays of 3, 5, 8, and 10 seconds. Other 4XX errors are not retried automatically.

When transient `Task not found` occurs, the script calls `task.detail` once for that retry cycle:

- `running`: continue polling
- `stopped`: retry `task.listMessages` so structured output can be read
- `error`: stop safely and store the error state

If `task.detail` includes `credit_usage`, the script stores that value as a fallback credit count.

It stops polling when:

- `structured_output_result.success` is `true`
- a `status_update.status` of `error` is seen
- a `status_update.status` of `waiting` is seen
- an `error_message` event is seen
- HTTP 429 rate limiting is returned
- the max polling attempts are exhausted

If `agent_status` or `status` is `stopped` but structured output has not appeared yet, the script performs one or two short extra checks before ending.

For HTTP 429 during polling, the script stops that task safely and stores a partial result instead of retrying aggressively.

## Credits

After each task finishes or errors, the script calls `usage.list` and scans recent usage pages for the matching `task_id`.

`usage.list` returns signed credit changes. Negative `credits` values represent consumption, while positive values may represent refunds or grants. The script stores the raw usage record so the spike can compare actual task-level values without guessing.

## Output

The script prints a concise console summary and writes a local JSON result file under:

```text
tmp/manus-reference-spike/
```

The exact saved JSON path is printed at the end of each run. The console summary only includes task/result status and credit summary; the API key is never printed.

Result files are written as UTF-8 JSON and parsed once immediately after saving. A successful write prints:

```text
saved JSON validation: ok
```

On Windows PowerShell, read the latest result with explicit UTF-8:

```powershell
$latest = Get-ChildItem .\tmp\manus-reference-spike\results-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Get-Content $latest.FullName -Raw -Encoding UTF8
```

The script also prints runner logs for real calls:

- spike started
- input URL count
- API key present as true or false
- creating Manus task
- task.create response received
- task_id present as true or false
- polling started
- transient Task not found retry count
- task.detail status
- structured output received
- polling ended with a safe reason
- final credits
- saved result JSON path

If `task.create` fails before a `task_id` is returned, the result JSON stores only safe HTTP diagnostics:

- endpoint
- HTTP status
- safe error message
- request ID if Manus returned one
- the fact that `task_id` was missing
- the fact that credit lookup was skipped

These result files are local test artifacts and should not be staged.

## Result Separation

Posty UI should keep source extraction data separate from AI analysis data:

- Source extraction data: `transcript`, `captions`, `audio_access_status`, `audio_access_notes`, `transcript_source`, `transcript_confidence`
- AI analysis data: `viral_factors`, `business_use_points`, `content_angles`, `risk_notes`

This matters because a Reel can be accessible enough for captions and business analysis even when a full transcript is unavailable.

## Future File Attachment Spike

If link-based tests continue returning `transcript=null`, the next isolated feasibility step is a file attachment spike using a user-prepared copy of the same video.

Official Manus input options to evaluate later:

- `file.upload` followed by attaching the returned `file_id`
- `file_url`
- `file_data`

That future spike should remain isolated from the production queue. It should not implement Instagram video auto-download, should not bypass platform terms, and should not add production attachment handling until feasibility is confirmed.
