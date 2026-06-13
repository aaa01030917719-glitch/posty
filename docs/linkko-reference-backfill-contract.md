# Linkko Reference Backfill Contract

This document defines the future Backfill contract between Linkko and Posty. It is a planning document only; no Backfill worker or live API call is implemented in this step.

## Goals

- Import existing Linkko links into Posty references without interrupting realtime collection.
- Preview and start Backfill per connected Linkko folder.
- Apply Posty reference analysis cost controls before Manus submission.
- Avoid duplicate analysis for the same canonical URL.
- Preserve existing reference sources, analysis rows, and latest analysis pointers.

## Posty Responsibilities

- Store connected folders in `public.linkko_folder_integrations`.
- Show connected folder status and Backfill readiness in `/references/settings`.
- Create and manage Backfill batches in `public.reference_import_batches`.
- Apply `reference_analysis_settings.daily_submission_limit` to any Backfill analysis submission.
- Prefer newly collected realtime links over Backfill jobs.
- Create Backfill analysis jobs with `submission_source='backfill'` and `priority=10`.
- Set `is_auto_submit_allowed` only when the user has explicitly enabled a future Backfill analysis flow.
- Reuse an existing reference when canonical URL fingerprint already exists for the user.
- Reuse existing completed analysis when a canonical URL already has a usable latest analysis.
- Never delete existing analysis rows during Backfill.

## Linkko Responsibilities

- Provide folder list lookup for the authenticated Linkko account connection.
- Provide per-folder link counts.
- Provide cursor-based existing-link pages for a selected folder.
- Return stable link IDs, folder IDs, URLs, title metadata, preview image metadata, memo, and created timestamps.
- Preserve cursor semantics across retries.
- Allow Posty to reconcile missing or changed source records without exposing private credentials to the browser.

## Folder List

Posty calls a Linkko API to fetch folders for the connected account.

Recommended Linkko response fields:

- `folderId`
- `folderName`
- `linkCount`
- `updatedAt`
- `isDeleted`

Posty stores only selected connected folders in `public.linkko_folder_integrations`. Disconnected folders keep historical source rows.

## Connect And Disconnect

Posty API owns connect and disconnect writes.

- Connect creates or re-enables `linkko_folder_integrations`.
- Disconnect sets `is_enabled=false` and `disconnected_at`.
- Disconnect does not delete `references`, `reference_sources`, `reference_analysis_jobs`, or `reference_analyses`.
- `auto_analyze_new_links` must be false for disabled folder integrations.

## Existing Link Preview

Before Backfill start, Posty may request a preview page from Linkko.

Recommended behavior:

- Page size: 50 links.
- Sort: newest first unless the user explicitly chooses another order.
- Include canonical candidate URL and source metadata.
- Do not create Posty references from preview alone.

## Backfill Start

Posty creates a `reference_import_batches` row with:

- `status='queued'`
- selected `linkko_folder_integration_id`
- initial cursor fields empty
- counters set to zero

The worker imports pages from Linkko using cursor-based pagination.

## Cursor Page Processing

Recommended page size: 50 links.

For each Linkko link:

1. Canonicalize URL in Posty.
2. Upsert `references` by `(user_id, url_fingerprint)`.
3. Upsert `reference_sources` by `(user_id, source_system, source_item_id)`.
4. Preserve original Linkko source metadata.
5. If a completed analysis already exists for the reference, reuse it.
6. If analysis is needed, create a Backfill job with `priority=10`.
7. Apply daily submission limit before any Manus submission.

## Pause, Resume, Cancel

Posty controls batch lifecycle:

- `pause`: queued or running batch moves to `pausing`, then `paused` after current page finishes.
- `resume`: paused batch moves to `resuming`, then `running`.
- `cancel`: queued, running, or paused batch moves to `canceling`, then `canceled`.
- `cancel` does not remove already imported references or analyses.

## Reconcile

Reconcile compares Linkko folder pages with Posty `reference_sources`.

- Missing source rows are re-created.
- Deleted Linkko links can set `source_deleted_at`.
- Existing Posty references and analyses are preserved.
- Reconcile should not create duplicate Manus submissions.

## Realtime Priority

New realtime Linkko events take priority over Backfill.

- Realtime analysis jobs use `submission_source='auto_realtime'` and `priority=100`.
- Backfill jobs use `submission_source='backfill'` and `priority=10`.
- Queue processors order by `priority desc, created_at asc`.

## Duplicate Analysis Policy

- Canonical URL fingerprint is the first duplicate guard.
- Active job unique index prevents simultaneous active jobs for one reference.
- Existing `latest_analysis_id` blocks default analysis creation.
- Manual reanalysis is a separate explicit route.
- Backfill should reuse existing analysis results and avoid deleting or replacing them.

## Cost Controls

All Backfill submissions must respect Posty policy controls:

- `reference_analysis_settings.is_auto_analysis_paused`
- `reference_analysis_settings.daily_submission_limit`
- Asia/Seoul day boundary
- `reference_analysis_jobs.is_auto_submit_allowed`

When auto analysis is paused, Backfill may import references and sources but must submit zero Manus tasks.

## Out Of Scope For This Step

- Linkko folder list implementation.
- Existing link preview implementation.
- Backfill worker implementation.
- Supabase SQL execution.
- Manus API calls.
