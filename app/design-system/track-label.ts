/** Presentation only; catalogue identity, links and accessible names stay intact. */
export function trackLabel(value: string) {
  const match = value.match(/^(.*?)\s+\((.+)\)$/);
  return { title: match?.[1] ?? value, subtitle: match?.[2] ?? null };
}
