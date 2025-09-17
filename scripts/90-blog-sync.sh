# ////scripts/90-blog-sync.sh
#!/bin/bash
set -euo pipefail

# Inputs via env:
#   BLOG_S3_BUCKET, BLOG_AWS_REGION, BLOG_SITEMAP_KEY
# Writes:
#   /var/www/juicejunkiez.com/blog/*
#   /var/www/juicejunkiez.com/blog-sitemap.xml

echo "[blog-sync] start at $(date --iso-8601=seconds)"

sudo mkdir -p /var/www/juicejunkiez.com/blog

# Sync post content
aws s3 sync "s3://${BLOG_S3_BUCKET}/blog" /var/www/juicejunkiez.com/blog \
  --region "${BLOG_AWS_REGION}" --delete --exclude "sitemap.xml" || true

# Download sitemap to a unique temp file (avoid rename collisions in /tmp)
TMP_XML="$(mktemp /tmp/blog-sitemap.XXXXXX.xml)"
aws s3 cp "s3://${BLOG_S3_BUCKET}/${BLOG_SITEMAP_KEY}" "${TMP_XML}" --region "${BLOG_AWS_REGION}" || true
if [[ -s "${TMP_XML}" ]]; then
  sudo cp "${TMP_XML}" /var/www/juicejunkiez.com/blog-sitemap.xml
  sudo chown root:root /var/www/juicejunkiez.com/blog-sitemap.xml
fi
rm -f "${TMP_XML}"

# Permissions
sudo chown -R root:root /var/www/juicejunkiez.com/blog || true
sudo find /var/www/juicejunkiez.com/blog -type d -exec chmod 755 {} \; || true
sudo find /var/www/juicejunkiez.com/blog -type f -exec chmod 644 {} \; || true

echo "[blog-sync] done at $(date --iso-8601=seconds)"