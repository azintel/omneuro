// apps/tech-gateway/src/lib/ssm.ts
//
// Securely load the OpenAI API key from AWS SSM Parameter Store (SecureString).
// - Defaults to /omneuro/prod/openai/api_key if OMNEURO_OPENAI_API_KEY_PARAM not set
// - Defaults region to us-east-2 if AWS_REGION not set
// - Caches in memory to avoid repeated lookups
//
// Requirements (instance role):
//   ssm:GetParameter on the parameter path
//   kms:Decrypt on the KMS key used by the SecureString

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const DEFAULT_PARAM = "/omneuro/prod/openai/api_key";

let cachedKey: string | null = null;

function getRegion(): string {
  const region = process.env.AWS_REGION || "us-east-2";
  if (!process.env.AWS_REGION) {
    console.warn(`[ssm] AWS_REGION not set; defaulting to ${region}`);
  }
  return region;
}

function getParameterName(): string {
  const name = process.env.OMNEURO_OPENAI_API_KEY_PARAM || DEFAULT_PARAM;
  if (!process.env.OMNEURO_OPENAI_API_KEY_PARAM) {
    console.warn(`[ssm] OMNEURO_OPENAI_API_KEY_PARAM not set; using default path: ${DEFAULT_PARAM}`);
  }
  return name;
}

export async function getOpenAIKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const region = getRegion();
  const Name = getParameterName();
  const ssm = new SSMClient({ region });

  try {
    const resp = await ssm.send(
      new GetParameterCommand({
        Name,
        WithDecryption: true, // decrypt SecureString server-side
      })
    );

    const value = resp.Parameter?.Value;
    if (!value) {
      throw new Error(`[ssm] Parameter ${Name} returned no value`);
    }
    cachedKey = value;
    return value;
  } catch (err: any) {
    // Provide helpful diagnostics without leaking secrets
    const code = err?.name || err?.code || "UnknownError";
    const msg = err?.message || String(err);
    console.error(`[ssm] get-parameter failed: name=${Name} region=${region} code=${code} msg=${msg}`);
    // Re-throw a generic error for the route to handle
    throw new Error("Failed to load OpenAI key from SSM");
  }
}