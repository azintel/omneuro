////scripts/90-blog-sync.sh
#!/usr/bin/env bash
# scripts/90-blog-sync.sh — one-shot blog sync used by redeploy & systemd

set -euo pipefail

BLOG_S3_BUCKET="${BLOG_S3_BUCKET:-juicejunkiez-site-prod}"
BLOG_AWS_REGION="${BLOG_AWS_REGION:-us-east-2}"
BLOG_SITEMAP_KEY="${BLOG_SITEMAP_KEY:-blog/sitemap.xml}"
WEBROOT="/var/www/juicejunkiez.com"

log(){ printf "[blog-sync] %s\n" "$*"; }

main() {
  log "start at $(date -Iseconds)"

  # Ensure webroot exists
  sudo mkdir -p "${WEBROOT}/blog"

  # Sync blog HTML (exclude sitemap.xml which belongs at web root)
  aws s3 sync "s3://${BLOG_S3_BUCKET}/blog" \
      "${WEBROOT}/blog" \
      --region "${BLOG_AWS_REGION}" \
      --delete \
      --exclude "sitemap.xml"

  # Fetch sitemap to a unique tmp file, then install atomically to web root
  tmp_xml="$(mktemp -t blog-sitemap.XXXXXX.xml)"
  if aws s3 cp "s3://${BLOG_S3_BUCKET}/${BLOG_SITEMAP_KEY}" "${tmp_xml}" --region "${BLOG_AWS_REGION}"; then
    # install sets perms and does atomic write
    sudo install -o root -g root -m 0644 "${tmp_xml}" "${WEBROOT}/blog-sitemap.xml"
    log "sitemap installed to ${WEBROOT}/blog-sitemap.xml"
  else
    log "WARN: could not fetch ${BLOG_SITEMAP_KEY} from s3://${BLOG_S3_BUCKET}"
  fi
  rm -f "${tmp_xml}"

  # Normalize perms
  sudo chown -R root:root "${WEBROOT}/blog"
  sudo find "${WEBROOT}/blog" -type d -exec chmod 755 {} \;
  sudo find "${WEBROOT}/blog" -type f -exec chmod 644 {} \;

  log "done at $(date -Iseconds)"
}

main "$@"