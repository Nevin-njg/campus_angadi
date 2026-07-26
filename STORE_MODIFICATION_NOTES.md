# Campus Angadi Store Marketplace – First Build

Implemented foundation:

- Added `SELLER` role.
- Added Store model with one seller per store.
- Added store-specific commission percentage.
- Added store-owned categories.
- Added public store directory and individual store browse/search pages.
- Added admin store-management route and page.
- Added seller dashboard with gross sales, commission, net earnings, products and order counts.
- Added store linkage fields to official products and orders.
- Added official delivery statuses: `DELIVERING_TO_CAMPUS` and `ARRIVED_AT_CAMPUS`.
- Kept second-hand modules, moderation, dealer flow, chat and calling intact.
- Store routes do not expose chat/calling for official-store orders.

Authentication update:

- Replaced email OTP login with Google Sign-In.
- Added `POST /api/v1/auth/google`.
- Verifies Google ID-token signature, issuer, audience, expiry and verified email on the API.
- Removed OTP and SMTP configuration from runtime validation and the login UI.
- Preserved MongoDB users, roles, JWT access tokens, refresh-token rotation and secure HttpOnly cookies.
- Added `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` environment variables.

Important next implementation slice:

- Full create/edit store form in Admin UI.
- Seller product/category/offer CRUD screens.
- Store-aware cart enforcement and checkout order splitting/restriction.
- Store order status-management screen.
- Monthly settlement and payout ledger.
- Product search results grouped across stores.
- Migration script for existing official products.
