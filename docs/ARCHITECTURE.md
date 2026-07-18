# Campus Angadi architecture

Campus Angadi is a TypeScript monorepo. It keeps the existing marketplace domain and uses one
consistent, feature-first architecture across the React web app and the Node.js API.

## Repository boundaries

- `apps/web`: React presentation and browser orchestration.
- `apps/api`: Express HTTP/API and Socket.IO runtime.
- `packages/contracts`: shared request, response, and validation contracts. Cross-app payloads are
  defined here first.
- `packages/config`: shared non-secret product defaults.
- `packages/validation`: shared domain-neutral validation helpers.

Applications may depend on packages. Packages must never depend on applications. The web app must
never import API implementation code.

## API module structure

Each business capability lives under `apps/api/src/modules/<feature>` and uses the same four
layers:

1. `domain`: business types and repository/storage ports. It does not import Express, Mongoose, or
   other delivery/database details.
2. `application`: use-case services. Services validate business rules and depend on domain ports.
3. `infrastructure`: Mongoose, Redis, SMTP, Cloudinary, and other port implementations.
4. `presentation`: thin Express routes, middleware, and socket adapters. Controllers validate a
   shared contract, call one application service, and serialize the result.

`app/composition-root.ts` is the only dependency-composition entry point. `app/create-app.ts` owns
HTTP middleware and route mounting. This is MVC-compatible in responsibility (routes/controllers,
services/models, views as JSON), while retaining explicit application and infrastructure boundaries
that keep business rules testable.

Dependency direction:

```text
presentation -> application -> domain <- infrastructure
                         composition-root wires implementations
```

## Web feature structure

Browser code is grouped under `apps/web/src/features/<feature>`:

- `api`: typed HTTP adapters only.
- `lib`: feature-specific pure mapping and navigation rules.
- `components`: reusable feature views.
- `pages`: route-level controllers/views that compose queries, mutations, and components.
- `store`: client-only state when server state is not appropriate.

Shared visual components belong in `components`; cross-feature browser infrastructure belongs in
`lib`; route composition belongs in `app`. React Query is the source of truth for server state,
Zustand holds the current in-memory authentication session, and form state remains local.

All account-owned query keys must include the user ID. All reads, mutation cache writes, and
invalidations must use `apps/web/src/lib/query-keys.ts`; literal cart/profile/order/notification
keys are not allowed because they can leak stale state across sessions.

## Checkout invariants

- Prices, publication state, active seller/category status, ownership, and stock are verified by
  the API immediately before order creation.
- Order creation and stock decrement require a MongoDB replica-set transaction.
- Cart checkout clears the checked-out cart within that transaction.
- Buy Now creates an order from an explicit product selection and never clears or replaces the
  existing cart.
- Browser-provided prices are never trusted.

## Required verification

Every production candidate must pass:

```bash
npm run check:release
```

Changes to a user flow require an application-service or route test on the API and a React flow test
on the web. A successful TypeScript build alone is not sufficient.
