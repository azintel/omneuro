# Secrets Handling

All sensitive credentials and contact information must be stored locally in the `.secrets/` directory.  
This folder is **never committed to git** and is ignored via `.gitignore`.

## Rules
- Always keep `.secrets/` in `.gitignore`.
- Never commit raw keys or secrets to the repo.
- Store secrets in JSON or `.env` files under `.secrets/`.
- Back up `.secrets/` locally and (if appropriate) in AWS Systems Manager Parameter Store.
- For domain registration, store `contact.json` here:
  - `.secrets/contact.json`
- For API keys, use:
  - `.secrets/openai.env`
  - `.secrets/google.env`
  - `.secrets/aws.env`

## Recovery
- If `.secrets/` is accidentally deleted on the server, recover from:
  - Local developer machine copy.
  - Secure backups (e.g., snapshot, Parameter Store).

**Golden Rule:** _Secrets live locally in `.secrets/` and are never in version control._
