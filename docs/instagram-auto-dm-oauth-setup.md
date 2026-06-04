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
