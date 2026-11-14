type IconName =
  | "play"
  | "pause"
  | "next"
  | "back"
  | "queue"
  | "search"
  | "close"
  | "plus"
  | "minus-circle"
  | "arrow"
  | "headphones"
  | "volume"
  | "check";
export function ListenerIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    play: <path d="m9 5 11 7-11 7Z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    next: (
      <>
        <path d="m5 5 11 7-11 7ZM19 5v14" />
      </>
    ),
    back: (
      <>
        <path d="m19 5-11 7 11 7ZM5 5v14" />
      </>
    ),
    queue: (
      <>
        <path d="M4 6h16M4 12h11M4 18h8m6-3 4 3-4 3Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    "minus-circle": (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    headphones: (
      <>
        <path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13h4v8H4zM16 13h4v8h-4z" />
      </>
    ),
    volume: (
      <>
        <path d="m11 5-6 5H2v4h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
