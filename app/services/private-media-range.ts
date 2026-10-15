export function invalidRange(range: string | null, size: number): boolean {
  if (!range) return false;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return true;
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (
    (start !== null && !Number.isSafeInteger(start)) ||
    (end !== null && !Number.isSafeInteger(end))
  )
    return true;
  if (start === null && end === 0) return true;
  if (start !== null && start >= size) return true;
  return start !== null && end !== null && end < start;
}
