#!/usr/bin/env sh
# Post-deploy smoke for Neuron API (Coolify / VPS).
# Usage: ./scripts/verify-deploy.sh https://api.yourdomain.com
#
# Optional env:
#   VERIFY_EXPECT_MEDIA=disabled|r2|local  (default: disabled)
#   VERIFY_EXPECT_WEB_PUSH=1             require VAPID configured
#   VERIFY_EXPECT_ANALYTICS=clickhouse|log_only

set -e
API="${1:-http://localhost:4000}"
API="${API%/}"

EXPECT_MEDIA="${VERIFY_EXPECT_MEDIA:-disabled}"
EXPECT_WEB_PUSH="${VERIFY_EXPECT_WEB_PUSH:-0}"
EXPECT_ANALYTICS="${VERIFY_EXPECT_ANALYTICS:-}"

echo "Checking $API/api/health ..."
body="$(curl -sf "$API/api/health")" || {
  echo "FAIL: cannot reach $API/api/health"
  exit 1
}

export EXPECT_MEDIA EXPECT_WEB_PUSH EXPECT_ANALYTICS

node -e "
const d = JSON.parse(process.argv[1]);
const s = d.services || {};
let ok = true;
const fail = (msg) => { console.error('FAIL:', msg); ok = false; };
const pass = (msg) => console.log('OK:', msg);

const expectMedia = process.env.EXPECT_MEDIA || 'disabled';
const expectWebPush = process.env.EXPECT_WEB_PUSH === '1';
const expectAnalytics = process.env.EXPECT_ANALYTICS || '';

if (d.status !== 'ok') fail('status is ' + d.status);
else pass('status ok');

if (s.postgres !== 'connected') fail('postgres ' + s.postgres);
else pass('postgres connected');

if (s.redis === 'error') fail('redis error');
else if (s.redis === 'connected') pass('redis connected');
else pass('redis ' + s.redis);

if (s.media !== expectMedia) fail('expected media ' + expectMedia + ', got ' + s.media);
else pass('media ' + s.media);

if (expectMedia === 'r2' && s.r2 !== 'configured') fail('R2 not configured for r2 media mode');
else if (expectMedia === 'r2') pass('r2 configured');

if (s.email === 'verification_required') pass('email verification + resend');
else if (s.email === 'verification_required_missing_resend') fail('REQUIRE_EMAIL_VERIFICATION without RESEND_*');
else pass('email ' + s.email);

if (expectWebPush) {
  if (s.webPush !== 'configured') fail('webPush not configured (set VAPID_* on API)');
  else pass('webPush configured');
} else if (s.webPush === 'configured') pass('webPush configured (optional)');

if (expectAnalytics) {
  if (s.analytics !== expectAnalytics) fail('expected analytics ' + expectAnalytics + ', got ' + s.analytics);
  else pass('analytics ' + s.analytics);
} else if (s.analytics) pass('analytics ' + s.analytics);

process.exit(ok ? 0 : 1);
" "$body"

echo "Checking $API/api/media/config ..."
media="$(curl -sf "$API/api/media/config")"
node -e "
const m = JSON.parse(process.argv[1]);
const expect = process.env.EXPECT_MEDIA || 'disabled';
const shouldEnable = expect !== 'disabled';
if (Boolean(m.enabled) !== shouldEnable) {
  console.error('FAIL: media.enabled=' + m.enabled + ' expected ' + shouldEnable);
  process.exit(1);
}
console.log('OK: media upload', shouldEnable ? 'enabled (' + m.mode + ')' : 'disabled');
" "$media"

echo "All deploy checks passed."
