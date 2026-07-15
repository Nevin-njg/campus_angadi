# Backup and restore

## MongoDB backup

Install MongoDB Database Tools and run:

```bash
MONGODB_URI='mongodb+srv://...' BACKUP_DIR=/secure/backups npm run backup:mongodb
```

The script creates a compressed archive named with a UTC timestamp. Send backups to encrypted
off-site storage and apply a retention policy such as daily for 14 days, weekly for 8 weeks, and
monthly for 12 months.

## Restore drill

Never test restoration against production. Restore into an isolated database first:

```bash
MONGODB_URI='mongodb://restore-host/campusbaza-restore' \
CONFIRM_RESTORE=YES \
npm run restore:mongodb -- /secure/backups/campusbaza-YYYYMMDDTHHMMSSZ.archive.gz
```

After restoration:

```bash
MONGODB_URI='mongodb://restore-host/campusbaza-restore' npm run db:indexes:check
```

Start a temporary API against the restored database and verify users, products, orders, dealer
assignments, status history, notifications, and audit logs.

## Cloudinary

MongoDB stores Cloudinary public IDs and URLs, while the media bytes remain in Cloudinary. Enable an
appropriate Cloudinary backup/versioning policy for the account. Do not permanently delete provider
backups until the database retention window has passed.

## Redis

Redis is not the source of truth for marketplace records. It contains short-lived OTP data,
distributed rate-limit counters, and job locks. Configure Redis persistence and high availability for
service continuity, but MongoDB remains the primary backup target.

## Secrets

Back up production environment values in a secure secrets manager. Never place secrets inside the
MongoDB archive, repository ZIP, or general shared storage.
