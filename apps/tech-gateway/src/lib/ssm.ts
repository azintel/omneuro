// apps/tech-gateway/src/lib/ssm.ts
//
// SSM helpers
// - getOpenAIKey(): backwards-compat convenience for existing code
// - getParam(name, withDecryption): generic getter used by sheets.ts
//
// Notes
// • Region defaults to us-east-2
// • We log diagnostic context but never leak secret values
// • NodeNext + TS: keep this as ESM with named exports

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const DEFAULT_OPENAI_PARAM = "/omneuro/prod/openai/api_key";

let cachedOpenAIKey: string | null = null;

function region(): string {
  const r = process.env.AWS_REGION || "us-east-2";
  if (!process.env.AWS_REGION) {
    console.warn(`[ssm] AWS_REGION not set; defaulting to ${r}`);
  }
  return r;
}

/** Generic SSM SecureString/plain getter (no local caching). */
export async function getParam(name: string, withDecryption = false): Promise<string> {
  const r = region();
  const ssm = new SSMClient({ region: r });
  try {
    const resp = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: withDecryption }));
    const value = resp.Parameter?.Value;
    if (!value) throw new Error(`[ssm] Parameter ${name} returned no value`);
    return value;
  } catch (err: any) {
    const code = err?.name || err?.code || "UnknownError";
    const msg = err?.message || String(err);
    console.error(`[ssm] get-param failed: name=${name} region=${r} code=${code} msg=${msg}`);
    throw err;
  }
}

/** Back-compat helper used by chat code. */
export async function getOpenAIKey(): Promise<string> {
  if (cachedOpenAIKey) return cachedOpenAIKey;
  const name = process.env.OMNEURO_OPENAI_API_KEY_PARAM || DEFAULT_OPENAI_PARAM;
  const value = await getParam(name, true);
  cachedOpenAIKey = value;
  return value;
}