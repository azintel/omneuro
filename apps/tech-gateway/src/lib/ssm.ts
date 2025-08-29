/**
 * SSM helper for Omneuro
 * - Fetches OpenAI API key from AWS SSM Parameter Store (SecureString)
 * - Caches value in-memory to avoid repeated SSM calls
 * - Uses safe defaults from docs if env vars are not set
 *
 * Requirements:
 *  - IAM role with ssm:GetParameter permission for the path
 *  - AWS_REGION configured (defaults to "us-east-2")
 *
 * Notes:
 *  - We pass WithDecryption so SecureString is decrypted server-side over TLS.
 */

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

let cachedKey: string | null = null;

function getParameterName(): string {
  // Hard default (source of truth in docs/secrets.md)
  const fallback = "/omneuro/prod/openai/api_key";
  const name = process.env.OMNEURO_OPENAI_API_KEY_PARAM || fallback;
  if (!process.env.OMNEURO_OPENAI_API_KEY_PARAM) {
    console.warn(
      `[ssm] OMNEURO_OPENAI_API_KEY_PARAM not set; using default path: ${fallback}`
    );
  }
  return name;
}

function getRegion(): string {
  const region = process.env.AWS_REGION || "us-east-2";
  if (!process.env.AWS_REGION) {
    console.warn(`[ssm] AWS_REGION not set; defaulting to ${region}`);
  }
  return region;
}

export async function getOpenAIKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const ssm = new SSMClient({ region: getRegion() });
  const Name = getParameterName();

  const resp = await ssm.send(
    new GetParameterCommand({
      Name,
      WithDecryption: true, // decrypt SecureString over TLS
    })
  );

  const value = resp.Parameter?.Value;
  if (!value) throw new Error(`[ssm] Parameter ${Name} has no value`);
  cachedKey = value;
  return value;
}