function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function createMediaDeliveryUrl(
  origin: string,
  kind: "artwork" | "audio",
  assetId: string,
  secret: string,
  now = new Date(),
): Promise<string> {
  const expires = Math.floor(now.getTime() / 1000) + 300;
  const path = `/media/${kind}/${assetId}`;
  const signature = await hmac(secret, `${path}:${expires}`);
  return `${origin}${path}?expires=${expires}&signature=${signature}`;
}

export async function verifyMediaSignature(
  url: URL,
  secret: string,
  now = new Date(),
): Promise<boolean> {
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature");
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(now.getTime() / 1000) || !signature) {
    return false;
  }
  const expected = await hmac(secret, `${url.pathname}:${expires}`);
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < signature.length; index += 1) {
    mismatch |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}
