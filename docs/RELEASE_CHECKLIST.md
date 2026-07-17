# Campus Angadi release checklist

## Automated gate

- [ ] `npm ci`
- [ ] `npm run check:release`
- [ ] `npm run db:indexes:ensure`
- [ ] `npm run db:indexes:check`
- [ ] `npm audit --audit-level=high`

## Infrastructure

- [ ] MongoDB is a replica set and transactions are enabled
- [ ] Redis authentication/TLS and persistence are enabled
- [ ] SMTP sender domain is verified
- [ ] Cloudinary credentials and folder are correct
- [ ] HTTPS is active for web and API
- [ ] CORS contains only the production web origin
- [ ] cookies are secure
- [ ] metrics token is set and metrics are network-restricted
- [ ] backups and a restore drill have been completed

## Real-service acceptance tests

- [ ] eligible campus email receives an OTP
- [ ] invalid domains receive the generic safe failure flow
- [ ] OTP expiry, resend cooldown, attempt limit, and single-use behavior work
- [ ] refresh rotation, logout, and logout-all revoke sessions
- [ ] Cloudinary upload, attachment, replacement, deletion, and stale cleanup work
- [ ] user listing stays private until approved
- [ ] listing approval/rejection/change request creates the correct notification
- [ ] two buyers cannot purchase the same final unit
- [ ] multi-seller checkout creates correctly grouped orders
- [ ] dealer capacity and least-load assignment work under concurrent checkout
- [ ] no available dealer preserves the order in the waiting state
- [ ] Buyer-to-team chat, voice notes and audio-call signaling work
- [ ] completion/cancellation releases dealer workload exactly once
- [ ] blocking a user revokes active sessions
- [ ] marketplace listing/order switches are enforced by the API
- [ ] super-admin operations page reports readiness and no unexpected index drift
- [ ] `npm run smoke:api` passes after deployment

## Accessibility and responsive review

- [ ] keyboard-only navigation reaches all actions
- [ ] skip link reaches the main content
- [ ] visible focus indicators remain present
- [ ] forms expose labels and errors
- [ ] dark and light themes meet readable contrast
- [ ] reduced-motion mode avoids long animations
- [ ] mobile search, cart, account, listing, checkout, and admin tables are usable

## Release sign-off

- [ ] production environment contains no development OTP console provider
- [ ] sample dealers and placeholder products are removed or replaced
- [ ] institutional naming and branding are approved
- [ ] support contact, terms, and privacy URLs are configured
- [ ] previous build is retained for rollback
