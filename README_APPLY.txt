Campus Angadi Seller - runtime session refresh fix

Fixes:
- Seller stays logged in when the short-lived access token expires.
- Store polling retries once with a refreshed access token after HTTP 401.
- Home polling and 2-second foreground order polling share one refresh operation,
  preventing refresh-token rotation races.
- Temporary USB/network/invalid-response errors no longer clear stored login.
- Keeps the alert schedule: 0-30s ring, 30-90s silent, 90-120s ring,
  120-180s silent, 180-210s ring.

Apply from repository root:
  unzip -o ~/Downloads/seller-mobile-session-refresh-fix.zip -d .

Then:
  cd apps/seller-mobile
  npx tsc --noEmit
