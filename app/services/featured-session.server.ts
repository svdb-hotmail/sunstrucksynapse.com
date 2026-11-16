const COOKIE_NAME = "ss-featured-visit";
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function featuredSession(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const existing = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  const seed = existing && SESSION_ID.test(existing) ? existing : crypto.randomUUID();
  const isNew = seed !== existing;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";

  return {
    seed,
    headers: {
      "Cache-Control": "private, no-store",
      ...(isNew
        ? { "Set-Cookie": `${COOKIE_NAME}=${seed}; Path=/; HttpOnly; SameSite=Lax${secure}` }
        : {}),
    },
  };
}
