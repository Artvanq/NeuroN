# Enable media uploads (R2 + scan)

v1 text-only uses `MEDIA_STORAGE=disabled`. Enable when you want attachments in **new thread** and **chat**.

## 1. Cloudflare R2

1. Create bucket `neuron-media`.
2. Create API token with Object Read & Write.
3. Optional: custom domain `media.yourdomain.com` → public bucket or CDN.
4. Apply lifecycle rules from `scripts/r2-lifecycle-rules.example.json`.

## 2. API environment

On **api** (and restart):

```env
MEDIA_STORAGE=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=neuron-media
R2_PUBLIC_URL=https://media.yourdomain.com
R2_MAX_UPLOAD_BYTES=26214400
```

## 3. Malware scan (recommended)

Point to your ClamAV sidecar, commercial API, or internal scanner:

```env
MEDIA_SCAN_URL=https://scanner.internal/scan
MEDIA_SCAN_TOKEN=shared-secret
MEDIA_SCAN_TIMEOUT_MS=6000
```

If `MEDIA_SCAN_URL` is empty, uploads proceed without scan (not recommended for public launch).

## 4. Verify

```bash
VERIFY_EXPECT_MEDIA=r2 ./scripts/verify-deploy.sh https://api.yourdomain.com
```

Manual:

- `GET /api/health` → `"media": "r2"`, `"r2": "configured"`
- `GET /api/media/config` → `{ "enabled": true, "mode": "r2" }`
- Create thread with image; send image in DM

## 5. Rollback

Set `MEDIA_STORAGE=disabled` and restart API. Existing URLs may still resolve from R2 until you purge objects.
