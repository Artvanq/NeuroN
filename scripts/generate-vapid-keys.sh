#!/usr/bin/env sh
# Generate Web Push VAPID keys for production .env
set -eu
cd "$(dirname "$0")/../neuron_backend/neuron_backend"
echo "Generating VAPID keys (add to API .env):"
npx --yes web-push generate-vapid-keys
echo ""
echo "Also set: VAPID_SUBJECT=mailto:ops@yourdomain.com"
