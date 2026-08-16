export function serializeJsonLd(value: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
