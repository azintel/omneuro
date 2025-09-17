# ////scripts/90-blog-sync.sh
#!/usr/bin/env bash
set -euo pipefail

# one-shot friendly: run with `--one-shot` from redeploy
ONESHOT="${1:-}"

BLOG_ROOT="/var/www/juicejunkiez.com"
BLOG_DIR="${BLOG_ROOT}/blog"
SYSCONFIG="/etc/sysconfig/omneuro-blog"

# Load env (bucket/region/sitemap key)
if [[ -f "$SYSCONFIG" ]]; then
  # shellcheck disable=SC1090
  source "$SYSCONFIG"
fi

: "${BLOG_S3_BUCKET:?missing BLOG_S3_BUCKET in $SYSCONFIG}"
: "${BLOG_AWS_REGION:?missing BLOG_AWS_REGION in $SYSCONFIG}"
: "${BLOG_SITEMAP_KEY:=blog/sitemap.xml}"

echo "[blog-sync] start at $(date --iso-8601=seconds)"

# Ensure target dirs exist and perms sane
sudo mkdir -p "${BLOG_DIR}"

# Sync site content (exclude sitemap.xml; we'll copy it separately)
# Use sudo so destination under /var/www is writeable
sudo aws s3 sync "s3://${BLOG_S3_BUCKET}/blog/" "${BLOG_DIR}/" \
  --region "${BLOG_AWS_REGION}" \
  --delete \
  --exclude "sitemap.xml" || true

# Copy sitemap.xml via unique temp file to avoid rename races
TMP_SITEMAP="$(mktemp /tmp/blog-sitemap.XXXXXX.xml)"
trap 'rm -f "$TMP_SITEMAP"' EXIT

aws s3 cp "s3://${BLOG_S3_BUCKET}/${BLOG_SITEMAP_KEY}" "$TMP_SITEMAP" \
  --region "${BLOG_AWS_REGION}" || true

if [[ -s "$TMP_SITEMAP" ]]; then
  sudo cp "$TMP_SITEMAP" "${BLOG_ROOT}/blog-sitemap.xml"
  sudo chown root:root "${BLOG_ROOT}/blog-sitemap.xml"
fi

# Tighten perms
sudo chown -R root:root "${BLOG_DIR}" || true
sudo find "${BLOG_DIR}" -type d -exec chmod 755 {} \; || true
sudo find "${BLOG_DIR}" -type f -exec chmod 644 {} \; || true

echo "[blog-sync] done at $(date --iso-8601=seconds)"