# Instagram Auto DM OAuth Setup

This integration connects one Instagram Professional account to Posty and
accepts signed comment webhook notifications. It does not send messages.

## Meta Developer App

1. Create or select a Meta Developer App.
2. Add **Instagram API with Instagram Login**.
3. Connect an Instagram Professional account for testing.
4. Add this production redirect URI exactly:

   `https://project-zzg5e.vercel.app/api/meta/instagram/oauth/callback`

5. Configure the permissions used by the connection flow:

   - `instagram_business_basic`
   - `instagram_business_manage_comments`
   - `instagram_business_manage_messages`

Development mode may limit OAuth to app roles and configured test accounts.
Production use requires the appropriate Meta App Review and business verification.

## Server Environment Variables

Configure these as server-only variables in Vercel. Do not use a
`NEXT_PUBLIC_` prefix and do not commit their values.

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_OAUTH_REDIRECT_URI`
- `INSTAGRAM_OAUTH_STATE_SECRET`
- `INSTAGRAM_TOKEN_ENCRYPTION_KEY`
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
- `INSTAGRAM_AUTO_DM_SEND_ENABLED`
- `POSTY_PUBLIC_BASE_URL`

`INSTAGRAM_TOKEN_ENCRYPTION_KEY` must be a base64-encoded 32-byte key.
PowerShell example:

```powershell
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Generate a separate OAuth state secret:

```powershell
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Keep the generated values separate and store them only in the server
environment configuration.

Use a separate, sufficiently long random value for
`INSTAGRAM_WEBHOOK_VERIFY_TOKEN`. Never commit the actual verify token.

`INSTAGRAM_AUTO_DM_SEND_ENABLED` controls outbound comment automation delivery.
Only the exact string `true` enables Private Reply and public comment reply
requests. Keep it unset or any value other than `true` until OAuth, webhook
payloads, and a single test rule have been verified against a real Meta test
account.

Keep `INSTAGRAM_AUTO_DM_SEND_ENABLED=false` while verifying OAuth and webhook
payload receipt. Only switch it to `true` after the connected account receives
real `comments` and `messages` webhook payloads and the payload shapes have
been reviewed.

`POSTY_PUBLIC_BASE_URL` is used only by server-side DM delivery to build public
share material links. Configure it to the canonical app origin, for example
`https://project-zzg5e.vercel.app`, without a trailing slash. Do not derive DM
links from inbound webhook host headers.

## Security Model

- OAuth state is HMAC-signed, expires after ten minutes, and must match an
  HttpOnly, SameSite=Lax cookie.
- The cookie is Secure in production and is deleted after callback success or
  failure.
- Access tokens, authorization codes, and app secrets are never logged.
- Access tokens are not included in browser responses or URL query strings.
- Long-lived access tokens are encrypted with AES-256-GCM before storage.
- Only encrypted token envelopes are stored in
  `instagram_connection_secrets.access_token_ciphertext`.
- The secrets table is accessed only with the server-side service role.
- Invalid or expired OAuth state never writes to the database.
- Outbound delivery code must not log access tokens, app secrets, raw webhook
  payloads, or raw Meta error bodies.

## OAuth Routes

- Start: `GET /api/meta/instagram/oauth/start`
- Callback: `GET /api/meta/instagram/oauth/callback`
- Safe connection status: `GET /api/auto-dm/connection`
- Webhook verification and events: `GET/POST /api/meta/instagram/webhook`

The OAuth callback and Instagram webhook are the only Instagram-specific
unauthenticated proxy exceptions. The OAuth start and connection-status routes
still validate the current Supabase user.

When configuration is missing, `/auto-dm` shows a configuration-required state
and the connection button remains disabled.

## Deployment Checklist

1. Add the server environment variables to the intended Vercel
   environments.
2. Verify the redirect URI matches the Meta app configuration exactly.
3. Confirm the auto-DM SQL schema has been applied before testing OAuth.
4. Redeploy after changing environment variables.
5. Test first with a Meta app role and a test Professional account.
6. Verify connected account metadata appears without exposing ciphertext.
7. Confirm App Review and business verification requirements before production.

## Webhook Setup

Register this callback URL in the Meta Dashboard after OAuth configuration is
ready:

`https://project-zzg5e.vercel.app/api/meta/instagram/webhook`

Use `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` as the verify token. POST requests are
validated with the existing `INSTAGRAM_APP_SECRET` and the raw request body
before payload parsing or database access.

Planned webhook subscriptions:

- `comments`
- `messages`
- Messaging postback-related fields if required after the Quick Reply
  feasibility test

These app-level fields must be selected in the Meta Dashboard. After OAuth
completes, Posty also subscribes the connected Instagram Professional account
itself by calling:

- `POST https://graph.instagram.com/v25.0/{ig_user_id}/subscribed_apps`
- `subscribed_fields=comments,messages`

Posty uses the explicit Instagram Professional account ID returned by the
metadata lookup, not the `/me` alias. After the POST succeeds, the OAuth
callback verifies the subscription with:

- `GET https://graph.instagram.com/v25.0/{ig_user_id}/subscribed_apps`

Existing connected accounts that were linked before this account-level
subscription step was added should be reconnected from `/auto-dm` with the
reconnect action. Reconnecting runs the OAuth callback again and applies the
account-level webhook subscription before the connection metadata is saved.

The `/auto-dm` connection card also checks this read-only subscription state.
Dashboard test sends only verify that the callback endpoint is reachable; they
do not prove that a real connected account is subscribed to receive comment
events.

The comment payload parser currently accepts the documented comments and
live-comments change shape, including object or array values. Actual payload
variants and subscriptions must be verified after connecting a Meta app.

The webhook ingress phase did not register the callback in Meta Dashboard, call
Meta APIs, send messages, or test real webhook delivery. Complete OAuth
connection first, then run a separate webhook feasibility test with configured
test accounts.

## Outbound Delivery Safety

Keyword-matched comment events are inserted with `initial_reply_status =
pending`. When `INSTAGRAM_AUTO_DM_SEND_ENABLED` is exactly `true`, the webhook
route schedules outbound delivery after the HTTP response with Next.js
`after()`. When the flag is absent or any other value, the webhook only stores
the event and does not call Meta.

The first outbound step sends an Instagram Private Reply with:

- `POST https://graph.instagram.com/v23.0/{ig_user_id}/messages`
- `recipient.comment_id` set to the original Instagram comment ID
- `message.text` set to the rule's initial Private Reply message

Private Reply is limited to one message per comment and must be sent within
Meta's allowed window. Do not manually retry uncertain network outcomes without
operator review.

Only after the Private Reply succeeds, the delivery processor attempts the
public comment reply with:

- `POST https://graph.instagram.com/v23.0/{ig_comment_id}/replies`
- `message` set to the rule's public reply message

If the Private Reply fails, the public reply is not attempted. If the public
reply fails, the event remains in `waiting_for_user_reply` because the initial
DM was already sent. Message-inbox webhook handling, follow checks, material
link delivery, and Quick Reply support are still future phases.

## Follow Confirmation Delivery

The messages webhook subscription is used for inbound Instagram DM text. Echo,
self, deleted, unsupported, and empty-text messages are ignored during payload
normalization. The MVP text command is exactly `팔로우완료` after trimming leading
and trailing whitespace.

When a user sends `팔로우완료`, the delivery processor looks up the most recent
waiting event for the same Instagram connection and sender IGSID. It only
considers events whose initial Private Reply was sent and whose lifecycle is
`waiting_for_user_reply` or `waiting_for_follow`.

The processor then calls the Instagram User Profile API for the messaging
webhook IGSID with the minimal fields:

- `username`
- `is_user_follow_business`

User consent is required by Meta before profile data is available. Consent is
established when the Instagram user sends a message to the connected account.

If `is_user_follow_business` is false, Posty sends the rule's follow-required
message and leaves the event waiting for follow. If true, Posty revalidates the
linked `content_share_links` row immediately before sending:

- the link exists
- `is_enabled = true`
- `disabled_at` is null
- `expires_at` is null or in the future
- the related content card is not deleted
- `material_delivery_message` still contains `{link}`
- `POSTY_PUBLIC_BASE_URL` is configured

The material DM uses the Instagram text message endpoint with
`recipient.id` and `message.text`. This phase does not test real Meta delivery,
send live DMs, or modify existing Supabase rows outside production webhook
execution with `INSTAGRAM_AUTO_DM_SEND_ENABLED=true`.

## Rule Media Picker

When creating or editing an auto-DM rule, Posty loads the connected Instagram
Professional account's recent media server-side and returns only safe list
metadata to the browser. The server uses:

- `GET https://graph.instagram.com/v25.0/{ig_user_id}/media`
- fields: `id`, `caption`, `media_type`, `media_product_type`, `permalink`,
  `thumbnail_url`, `media_url`, `timestamp`

The browser response excludes access tokens, ciphertext, raw Meta responses,
owner user IDs, and any secret values. Manual Media ID entry remains available
only as a fallback inside the rule modal, primarily for existing rules whose
saved media is no longer in the most recent 25 items.

## Latency Diagnostics

Posty emits safe operational timing logs with the prefix:

- `[instagram-latency]`

These diagnostics do not print access tokens, app secrets, ciphertext, raw
webhook payloads, raw Meta responses, comment text, message text, usernames,
scoped IDs, media IDs, comment IDs, message IDs, share tokens, or share URLs.

Message webhook ingress logs include:

- `webhookDeliveryLagMs`
- `afterScheduled`

Follow-confirmation delivery logs include:

- `afterStartDelayMs`
- `connectionLookupMs`
- `waitingEventLookupMs`
- `secretLookupMs`
- `decryptMs`
- `profileFetchMs`
- `shareLinkValidationMs`
- `materialMessageSendMs`
- `finalEventUpdateMs`
- `totalProcessorMs`

After deployment, reproduce the follow-confirmation flow once and inspect the
`[instagram-latency]` entries to identify whether delay is happening before the
webhook reaches Posty, while the Next.js `after()` callback waits to start,
during Supabase lookups, during Meta profile fetch, during share-link
validation, or during Meta message send. If delays remain consistently high,
evaluate a dedicated queue or background job processor in a separate phase;
this step only adds diagnostics and does not introduce a queue.
