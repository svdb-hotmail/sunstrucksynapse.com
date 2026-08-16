import { useState } from "react";

interface ShareButtonProps {
  title: string;
  url: string;
}

export function ShareButton({ title, url }: ShareButtonProps) {
  const [status, setStatus] = useState<string | null>(null);

  const share = async () => {
    setStatus(null);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setStatus("Shared.");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setStatus("Canonical link copied.");
        return;
      }
      setStatus("Sharing is not available in this browser.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setStatus("The link could not be shared. Copy it from the address bar.");
    }
  };

  return (
    <div className="share-control">
      <button type="button" onClick={() => void share()}>
        Share
      </button>
      {status ? (
        <span role="status" aria-live="polite">
          {status}
        </span>
      ) : null}
    </div>
  );
}
