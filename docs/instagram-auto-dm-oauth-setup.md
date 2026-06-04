# Instagram Auto DM OAuth Setup

This feasibility spike connects one Instagram Professional account to Posty.
It does not receive webhooks or send messages.

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

## OAuth Routes

- Start: `GET /api/meta/instagram/oauth/start`
- Callback: `GET /api/meta/instagram/oauth/callback`
- Safe connection status: `GET /api/auto-dm/connection`

The callback is the only new unauthenticated proxy exception. The start and
connection-status routes still validate the current Supabase user.

When configuration is missing, `/auto-dm` shows a configuration-required state
and the connection button remains disabled.

## Deployment Checklist

1. Add the five server environment variables to the intended Vercel
   environments.
2. Verify the redirect URI matches the Meta app configuration exactly.
3. Confirm the auto-DM SQL schema has been applied before testing OAuth.
4. Redeploy after changing environment variables.
5. Test first with a Meta app role and a test Professional account.
6. Verify connected account metadata appears without exposing ciphertext.
7. Confirm App Review and business verification requirements before production.

The next phase is a separate webhook feasibility spike for Instagram comments
and messages. This OAuth spike does not register webhook subscriptions or call
messaging APIs.
