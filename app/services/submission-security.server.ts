import { IncrementalSha256 } from "~/utils/sha256";

export function sha256Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return new IncrementalSha256().update(bytes).digestHex();
}
