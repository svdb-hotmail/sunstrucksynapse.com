export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; fieldErrors: Readonly<Record<string, string>> };

export interface CatalogueForm {
  slug: string;
  title: string;
}

function stringField(source: FormData | URLSearchParams, name: string): string {
  const value = source.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function validateCatalogueForm(
  source: FormData | URLSearchParams,
): ValidationResult<CatalogueForm> {
  const slug = stringField(source, "slug");
  const title = stringField(source, "title");
  const fieldErrors: Record<string, string> = {};
  if (!SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = "Use lowercase letters, numbers, and single hyphens.";
  }
  if (title.length === 0 || title.length > 200) {
    fieldErrors.title = "Enter a title between 1 and 200 characters.";
  }
  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, value: { slug, title } };
}

export function validateReason(reason: unknown): ValidationResult<string> {
  const value = typeof reason === "string" ? reason.trim() : "";
  return value.length > 0 && value.length <= 1000
    ? { ok: true, value }
    : { ok: false, fieldErrors: { reason: "A reason of at most 1000 characters is required." } };
}

export function validateUuid(value: unknown, field = "id"): ValidationResult<string> {
  const normalized = typeof value === "string" ? value : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized,
  )
    ? { ok: true, value: normalized }
    : { ok: false, fieldErrors: { [field]: "A valid identifier is required." } };
}
