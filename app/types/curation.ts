export const CURATION_RATIONALE_MAX_CHARACTERS = 8_000;
export const CURATION_RATIONALE_MAX_UTF8_BYTES = 32_000;

export function curationRationaleError(value: string): string | null {
  if (!value) return "Decision rationale is required.";
  if (
    value.length > CURATION_RATIONALE_MAX_CHARACTERS ||
    new TextEncoder().encode(value).byteLength > CURATION_RATIONALE_MAX_UTF8_BYTES
  ) {
    return "Decision rationale is too long.";
  }
  return null;
}
