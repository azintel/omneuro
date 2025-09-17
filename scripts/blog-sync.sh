# scripts/blog-sync.sh
#!/usr/bin/env bash
set -euo pipefail

# Load env exported by redeploy for systemd jobs
if [[ -f /etc/sysconfig/omneuro-blog ]]; then
  set -a
  # shellcheck source=/dev/null
  . /etc/sysconfig/omneuro-blog
  set +a
fi

: "${BLOG_S3_BUCKET:?BLOG_S3_BUCKET required}"
: "${BLOG_AWS_REGION:=us-east-2}"

WEBROOT="/var/www/juicejunkiez.com"
BLOG_DIR="${WEBROOT}/blog"

sudo mkdir -p "${BLOG_DIR}"

# Sync blog HTML (exclude sitemap.xml which we place at webroot)
aws s3 sync "s3://${BLOG_S3_BUCKET}/blog" "${BLOG_DIR}" \
  --region "${BLOG_AWS_REGION}" \
  --delete --exclude "sitemap.xml" || true

# Permissions: dirs 755, files 644
sudo chown -R root:root "${BLOG_DIR}" || true
sudo find "${BLOG_DIR}" -type d -exec chmod 755 {} \; || true
sudo find "${BLOG_DIR}" -type f -exec chmod 644 {} \; || true

# Refresh blog-sitemap.xml into webroot (best-effort)
if [[ -n "${BLOG_SITEMAP_KEY:-}" ]]; then
  aws s3 cp "s3://${BLOG_S3_BUCKET}/${BLOG_SITEMAP_KEY}" "/tmp/blog-sitemap.xml" --region "${BLOG_AWS_REGION}" || true
  if [[ -s /tmp/blog-sitemap.xml ]]; then
    sudo cp /tmp/blog-sitemap.xml "${WEBROOT}/blog-sitemap.xml"
    sudo chown root:root "${WEBROOT}/blog-sitemap.xml"
  fi
fi

echo "[blog-sync] done at $(date -Is)"