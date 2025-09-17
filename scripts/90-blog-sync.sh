# ////scripts/90-blog-sync.sh
#!/usr/bin/env bash
set -euo pipefail

# Inputs expected in env (provided by redeploy):
#   BLOG_S3_BUCKET
#   BLOG_AWS_REGION
#   BLOG_SITEMAP_KEY   (e.g., blog/sitemap.xml)
#   BLOG_PREFIX        (e.g., blog)
#
# This script never lets awscli write directly into /var/www.
# We copy to /tmp first, then sudo-rsync into place.

WEB_ROOT="/var/www/juicejunkiez.com"
BLOG_DIR="${WEB_ROOT}/blog"
TMP_ROOT="$(mktemp -d)"
TMP_SYNC="${TMP_ROOT}/sync"
TMP_SITEMAP="${TMP_ROOT}/sitemap.xml"

echo "[blog-sync] start at $(date --iso-8601=seconds)"

# Validate minimum inputs
: "${BLOG_S3_BUCKET:?missing BLOG_S3_BUCKET}"
: "${BLOG_AWS_REGION:?missing BLOG_AWS_REGION}"
: "${BLOG_SITEMAP_KEY:=blog/sitemap.xml}"
: "${BLOG_PREFIX:=blog}"

# Ensure target dirs exist and have safe perms
sudo mkdir -p "${BLOG_DIR}"
sudo chown -R root:root "${BLOG_DIR}"
sudo find "${BLOG_DIR}" -type d -exec chmod 755 {} \; || true
sudo find "${BLOG_DIR}" -type f -exec chmod 644 {} \; || true

mkdir -p "${TMP_SYNC}"

# 1) Sync blog content (except sitemap) to tmp, then rsync into place
aws s3 sync "s3://${BLOG_S3_BUCKET}/${BLOG_PREFIX}" "${TMP_SYNC}/" \
  --region "${BLOG_AWS_REGION}" \
  --delete \
  --no-progress \
  --exclude "$(basename "${BLOG_SITEMAP_KEY}")" || true

sudo rsync -a --delete "${TMP_SYNC}/" "${BLOG_DIR}/"

# 2) Refresh sitemap to /tmp then atomically install to web root
aws s3 cp "s3://${BLOG_S3_BUCKET}/${BLOG_SITEMAP_KEY}" "${TMP_SITEMAP}" \
  --region "${BLOG_AWS_REGION}" --no-progress || true

if [[ -s "${TMP_SITEMAP}" ]]; then
  sudo install -m 0644 -o root -g root "${TMP_SITEMAP}" "${WEB_ROOT}/blog-sitemap.xml"
fi

# 3) Final tighten perms
sudo chown -R root:root "${BLOG_DIR}"
sudo find "${BLOG_DIR}" -type d -exec chmod 755 {} \; || true
sudo find "${BLOG_DIR}" -type f -exec chmod 644 {} \; || true

echo "[blog-sync] done at $(date --iso-8601=seconds)"