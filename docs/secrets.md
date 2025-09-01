# Secrets

Omneuro uses AWS SSM Parameter Store for secret management.  
All secrets are stored as SecureString and never committed to the repo.

---

## Paths

- /omneuro/openai/api_key — OpenAI project API key
- /omneuro/google/api_key — Google API key
- /omneuro/google/client_id — Google OAuth client ID
- /omneuro/google/client_secret — Google OAuth client secret
- (future) /omneuro/telnyx/api_key — Telnyx API key

---

## IAM Policy

Attach inline policy to OmneuroSSMRole:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
        "ssm:DescribeParameters"
      ],
      "Resource": "arn:aws:ssm:us-east-2:<ACCOUNT_ID>:parameter/omneuro/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:DescribeKey"],
      "Resource": "arn:aws:kms:us-east-2:<ACCOUNT_ID>:key/<KMS-KEY-ID>"
    }
  ]
}

---

## Usage

- tech-gateway  
  Reads OMNEURO_OPENAI_API_KEY_PARAM (default: /omneuro/openai/api_key) at runtime,  
  fetches the value from SSM, and caches in memory.  
  Requires AWS_REGION to be set (us-east-2).

- brain-api  
  May later consume Google or Telnyx keys for additional integrations.

---

## Guidelines

1. Always create new secrets in SSM with --type SecureString and --with-key-id if KMS required.  
2. Never commit actual values to GitHub or logs.  
3. Reference secrets by SSM path in code or configs.  
4. Rotate sensitive keys (OpenAI, Stripe, Telnyx, Google) regularly.  
5. Verify permissions after adding new parameters — missing ssm:GetParameter or kms:Decrypt will break runtime.  

---

## Necessity Explanation

Secrets management is central to Omneuro’s reliability and security:

- Ensures no plaintext secrets exist in code or repo.  
- Centralizes control with AWS IAM, making auditing and rotation easier.  
- Supports multiple environments (dev, staging, prod) by using different SSM paths.  
- Prevents accidental leakage in logs, client builds, or browser output.  
- Simplifies redeployments: apps fetch secrets live at runtime, not from baked configs.  

---

## Example Workflow

1. Store a new secret:

aws ssm put-parameter \
  --name "/omneuro/openai/api_key" \
  --type SecureString \
  --value "sk-..." \
  --overwrite

2. Verify secret is present:

aws ssm get-parameter \
  --name "/omneuro/openai/api_key" \
  --with-decryption

3. Redeploy app to pick up new secret:

cd ~/omneuro
./scripts/04-redeploy.sh

---

## Notes

- Secrets are fetched at runtime (not build time).  
- If a secret is missing or permissions are wrong, the app logs will show:

[ssm] get-parameter failed: name=/omneuro/openai/api_key region=us-east-2

- In such cases, check:  
  - IAM role OmneuroSSMRole has ssm:GetParameter and kms:Decrypt.  
  - Parameter exists in SSM at the expected path.  
  - AWS_REGION is correctly set in environment (default: us-east-2).  
