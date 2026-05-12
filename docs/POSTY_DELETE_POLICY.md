# Posty Delete Policy

## Purpose

Posty treats content history as product data, not as disposable UI state. A content delete feature must preserve the activity timeline, support recovery from mistakes, and avoid accidental loss of related work such as scripts, checklist state, campaign context, and schedule history.

This document records the current schema behavior and the recommended deletion policy before implementing any delete UI or SQL migration.

## Current Schema Findings

Current references checked:

- `docs/supabase/schema.sql`
- `docs/supabase/add_content_activity_logs.sql`

The current `content_activity_logs` table defines:

```sql
card_id uuid references public.content_cards (id) on delete cascade
project_id uuid references public.content_projects (id) on delete set null
```

The current `content_cards` table does not have soft-delete columns such as `deleted_at`, `deleted_reason`, or `is_deleted`.

Related tables also cascade from `content_cards`:

- `scripts.card_id references public.content_cards(id) on delete cascade`
- `card_tags.card_id references public.content_cards(id) on delete cascade`
- `content_activity_logs.card_id references public.content_cards(id) on delete cascade`

## Hard Delete Impact

If Posty hard deletes a `content_cards` row today:

- The content card row is permanently removed.
- Its scripts are deleted by cascade.
- Its card tag links are deleted by cascade.
- Its activity logs with `card_id` are deleted by cascade.
- A `deleted` activity log written with the deleted `card_id` would also be removed by the same cascade.
- A `deleted` activity log could only remain if written with `card_id = null`, but then it would lose the card relationship and detail navigation context.

Therefore, current hard delete behavior conflicts with the requirement that deletion remains visible in `/timeline`.

## Recommendation

Posty content deletion should use soft delete by default.

Policy:

- Deleting content updates the content card instead of removing the row.
- Deleted content remains in the database so activity logs can continue to reference `card_id`.
- Deleting content writes a `content_activity_logs` row with `action = deleted`.
- Deleted content is hidden from default `/content` lists.
- Deleted content is hidden from default `/schedule` views and recent schedule activity should still show the `deleted` action when relevant.
- `/timeline` continues to show the `deleted` activity log.
- A later `/trash` page or trash filter can list deleted content and allow restore.
- Hard delete is reserved for a later admin/permanent-delete flow.

## Recommended Soft Delete Fields

A follow-up SQL migration should add soft-delete fields to `public.content_cards`.

Suggested columns:

- `is_deleted boolean not null default false`
- `deleted_at timestamptz null`
- `deleted_reason text null`

Optional later fields:

- `deleted_by uuid null references auth.users(id) on delete set null`
- `restored_at timestamptz null`
- `restored_by uuid null references auth.users(id) on delete set null`

## Activity Log Policy

When a content card is soft-deleted:

- Record `action = deleted`.
- Use the content title as `title`.
- Use a short description such as `콘텐츠를 삭제했습니다`.
- Set `card_id` to the deleted content card id.
- Set `project_id` to the card project id, if any.
- Include metadata such as:
  - `project_id`
  - `scheduled_at`
  - `status`
  - `deleted_at`
  - `deleted_reason`

Activity log insert failure must not block the soft-delete update if the content card update succeeded.

## Query Policy

Default product queries should exclude deleted content:

- `/content`: add `is_deleted = false` filtering for normal lists.
- `/schedule`: add `is_deleted = false` filtering for calendar cards.
- Content detail route: decide whether deleted cards are viewable read-only or redirect to trash.

Timeline queries should not exclude logs for deleted cards:

- `/timeline` should continue to read from `content_activity_logs`.
- Logs should remain visible even when the related card is soft-deleted.

Trash queries should include only deleted content:

- `/trash` or a trash filter should query `is_deleted = true`.
- Restore should set `is_deleted = false`, clear deletion fields, and optionally record a restore activity action later.

## Follow-Up SQL Proposal

Do not create or run SQL as part of this policy step.

For the next migration step, create a dedicated SQL file that:

- Adds `is_deleted`, `deleted_at`, and `deleted_reason` to `public.content_cards`.
- Adds indexes useful for default filtering:
  - `(user_id, is_deleted)`
  - `(user_id, is_deleted, scheduled_at)`
- Optionally adds `deleted_by` if the product needs explicit actor tracking outside the activity log.
- Keeps `content_activity_logs.card_id` as-is if soft delete is adopted, because the content card row remains.

If Posty later needs true permanent delete while preserving logs, the FK should be reconsidered separately, for example changing `content_activity_logs.card_id` from `on delete cascade` to `on delete set null`. That should be a separate admin/permanent-delete design, not the default user delete flow.

## Not Implemented In This Step

- No delete button.
- No trash page.
- No app code changes.
- No DB schema changes.
- No SQL migration file.
- No SQL execution.
- No timeline UI changes.
