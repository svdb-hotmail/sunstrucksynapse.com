import { Link } from "react-router";

import { SITE_NAME, SITE_URL } from "~/config/brand";

const SITE_HOSTNAME = new URL(SITE_URL).hostname.replace(/^www\./, "");

export function ProductBrand({
  destination,
  context = "listener",
}: {
  destination: string;
  context?: "listener" | "curator";
}) {
  const isCurator = context === "curator";

  return (
    <Link
      className={isCurator ? "curator-brand" : "site-logo"}
      to={destination}
      aria-label={isCurator ? `${SITE_NAME} curator workspace` : `${SITE_NAME} home`}
    >
      <span className={isCurator ? "curator-brand__mark" : "mini-orb"} aria-hidden="true">
        ☼
      </span>
      {isCurator ? (
        <span>
          <strong>{SITE_HOSTNAME}</strong>
          <small>Curator workspace</small>
        </span>
      ) : (
        <span className="site-wordmark">{SITE_HOSTNAME}</span>
      )}
    </Link>
  );
}
