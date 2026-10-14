/** Upload endpoints can return a provider error page instead of application JSON. */
export async function readUploadResponse<T extends object>(
  response: Response,
  fallback: string,
): Promise<T> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(fallback);
  }
  if (!response.ok) {
    const message: unknown = Reflect.get(value, "error");
    throw new Error(typeof message === "string" && message ? message : fallback);
  }
  return value as T;
}

export async function sendUploadRequest(
  url: string,
  init: RequestInit,
  connectionMessage: string,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(connectionMessage);
  }
}
