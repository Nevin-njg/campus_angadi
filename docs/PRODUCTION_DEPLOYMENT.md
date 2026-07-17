# Campus Angadi production deployment

Campus Angadi is deployed without Docker. The recommended production topology is:

- Node.js 22 LTS for the API
- a static web host or Nginx for `apps/web/dist`
- MongoDB Atlas or another replica-set deployment
- Redis with persistence and authentication
- an SMTP provider
- Cloudinary
- HTTPS at the reverse proxy or platform load balancer

## 1. Production environment

Copy `.env.example` to a protected environment file outside the repository. At minimum:

```env
NODE_ENV=production
LOG_LEVEL=info
WEB_URL=https://campusbaza.example.edu
API_URL=https://api.campusbaza.example.edu
CORS_ALLOWED_ORIGINS=https://campusbaza.example.edu

MONGODB_URI=mongodb+srv://...
MONGODB_AUTO_INDEX=false
MONGODB_MAX_POOL_SIZE=30
MONGODB_MIN_POOL_SIZE=5
REDIS_URL=rediss://...
OTP_STORE=redis

EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax

METRICS_ENABLED=true
METRICS_TOKEN=<long-random-secret>

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CHAT_AUDIO_MAX_BYTES=8000000

# Web build-time variables
VITE_API_URL=https://api.campusbaza.example.edu/api/v1
VITE_WEBRTC_ICE_SERVERS_JSON=[{"urls":"stun:stun.example.edu:3478"},{"urls":"turns:turn.example.edu:5349","username":"short-lived-user","credential":"short-lived-credential"}]
```

Configure a TURN service for reliable audio calls across campus, mobile, and restrictive networks.
Prefer short-lived TURN credentials issued by your infrastructure provider.

Generate unrelated secrets for OTP hashing, access tokens, refresh tokens, and metrics. Do not reuse a
password or commit the environment file.

## 2. Release validation

```bash
npm ci
npm run check:release
npm run db:indexes:ensure
npm run db:indexes:check
```

`db:indexes:ensure` creates missing indexes but deliberately does not drop obsolete indexes. Review
anything listed by `db:indexes:check` before removing it manually.

## 3. Build

```bash
npm run build
```

Outputs:

```text
apps/api/dist
apps/web/dist
```

## 4. API process

Example systemd unit:

```ini
[Unit]
Description=Campus Angadi API
After=network.target

[Service]
Type=simple
User=campusbaza
WorkingDirectory=/srv/campusbaza
EnvironmentFile=/etc/campusbaza/api.env
ExecStart=/usr/bin/node apps/api/dist/server.js
Restart=always
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/srv/campusbaza

[Install]
WantedBy=multi-user.target
```

The API handles `SIGTERM` and `SIGINT`, stops scheduled jobs, closes HTTP connections, disconnects
MongoDB and Redis, and enforces a shutdown deadline.

## 5. Nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name campusbaza.example.edu;

    root /srv/campusbaza/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 443 ssl http2;
    server_name api.campusbaza.example.edu;

    client_max_body_size 45m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-Id $request_id;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 35s;
    }
}
```

Use a valid TLS certificate and redirect HTTP to HTTPS. The API trusts one reverse-proxy hop in
production.

## 6. Health and metrics

```text
GET /api/v1/health
GET /api/v1/ready
GET /api/v1/metrics
```

- `/health` checks that the process responds.
- `/ready` checks MongoDB and required Redis readiness.
- `/metrics` emits Prometheus-compatible process, HTTP, and cleanup metrics. Supply
  `Authorization: Bearer <METRICS_TOKEN>`.

Do not expose metrics publicly without network controls and the token.

## 7. Scheduled cleanup

Each API instance starts the cleanup scheduler, but Redis grants the work to only one instance. The
lock is renewed while a run is active. Cleanup handles:

- unattached Cloudinary uploads older than the configured retention
- read notifications past retention
- expired and old revoked sessions
- audit logs past retention
- approved second-hand listings past the configured listing-expiration period

Super administrators can inspect and run cleanup from `/admin/operations`.

## 8. Smoke test

After deployment:

```bash
API_BASE_URL=https://api.campusbaza.example.edu/api/v1 \
METRICS_TOKEN=<token> \
npm run smoke:api
```

Then perform the real-service checklist in `RELEASE_CHECKLIST.md`.

## 9. Rollback

Keep the previous API build and frontend build until the release is verified. Application changes in
Part 7 are backward-compatible; index creation is additive. If rollback is necessary:

1. stop the new API process
2. restore the previous build
3. restart the service
4. verify `/health` and `/ready`
5. restore MongoDB only when data itself was damaged, not merely because code was rolled back
