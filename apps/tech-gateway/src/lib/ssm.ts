// tech-gateway/src/lib/ssm.ts
//
// Purpose: Securely fetch secrets and configs from AWS SSM Parameter Store.
// Usage:
//   - We do NOT hardcode secret values or parameter names in code.
//   - Set the parameter NAME via env (non-secret), e.g.:
//       OMNEURO_OPENAI_API_KEY_PARAM=/omneuro/prod/openai/api_key
//     (Confirm the exact path in docs/secrets.md; set env accordingly.)
//   - Requires instance role permissions: ssm:GetParameter (+ kms:Decrypt for SecureString).
//
// Notes:
//   - Region defaults to us-east-2 to match our stack; override with AWS_REGION if needed.
//   - Simple in-memory TTL cache avoids repeated SSM calls per process.
//   - No secret values are logged.

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

type CacheEntry = { value: string; expiresAt: number };

const REGION = process.env.AWS_REGION || "us-east-2";
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

const ssm = new SSMClient({ region: REGION });
const cache = new Map<string, CacheEntry>();

/**
 * Fetch a parameter (SecureString or String) from SSM with optional TTL caching.
 * @param paramName full parameter path (e.g. "/omneuro/prod/openai/api_key")
 * @param opts.withDecryption true for SecureString
 * @param opts.ttlMs cache TTL in ms (default 10 minutes). Pass 0 to disable caching.
 */
export async function getParam(
  paramName: string,
  opts: { withDecryption?: boolean; ttlMs?: number } = {}
): Promise<string> {
  if (!paramName) throw new Error("getParam: missing parameter name");

  const withDecryption = opts.withDecryption ?? true;
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const key = `${REGION}:${paramName}:${withDecryption ? "dec" : "nodec"}`;

  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const out = await ssm.send(
    new GetParameterCommand({
      Name: paramName,
      WithDecryption: withDecryption,
    })
  );

  const value = out.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter not found or empty: ${paramName}`);

  if (ttlMs > 0) {
    cache.set(key, { value, expiresAt: now + ttlMs });
  }

  return value;
}

/**
 * Convenience accessor for the OpenAI API key used by the chat route.
 * The parameter name is provided via ENV (non-secret):
 *   OMNEURO_OPENAI_API_KEY_PARAM=/omneuro/prod/openai/api_key
 * Confirm the exact path in docs/secrets.md and set this env var (PM2 ecosystem or /etc/environment).
 */
export async function getOpenAIKey(): Promise<string> {
  const paramName = process.env.OMNEURO_OPENAI_API_KEY_PARAM || "";
  if (!paramName) {
    throw new Error(
      "Missing OMNEURO_OPENAI_API_KEY_PARAM env. Set it to your SSM path (see docs/secrets.md)."
    );
  }
  return getParam(paramName, { withDecryption: true });
}