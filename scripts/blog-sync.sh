# scripts/blog-sync.sh
#!/usr/bin/env bash
set -euo pipefail

# Sync blog content from S3 to nginx webroot.
# Expects BLOG_S3_BUCKET and BLOG_AWS_REGION in env (04-redeploy passes them in).
# Safe defaults below so it also works when run manually.

BLOG_S3_BUCKET="${BLOG_S3_BUCKET:-juicejunkiez-site-prod}"
BLOG_AWS_REGION="${BLOG_AWS_REGION:-us-east-2}"

WEB_ROOT="/var/www/juicejunkiez.com"
BLOG_DST="${WEB_ROOT}/blog"

# Ensure webroot exists
sudo mkdir -p "${BLOG_DST}"

# Pull everything under s3://<bucket>/blog except sitemap.xml (that lives at site root separately)
aws s3 sync "s3://${BLOG_S3_BUCKET}/blog" "${BLOG_DST}" \
  --region "${BLOG_AWS_REGION}" \
  --delete \
  --exclude "sitemap.xml"

# Permissions (nginx-friendly)
sudo chown -R root:root "${BLOG_DST}"
sudo find "${BLOG_DST}" -type d -exec chmod 755 {} \;
sudo find "${BLOG_DST}" -type f -exec chmod 644 {} \;

echo "[blog-sync] OK: $(date -Is) bucket=${BLOG_S3_BUCKET} region=${BLOG_AWS_REGION}"