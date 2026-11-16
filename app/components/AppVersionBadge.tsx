import { useState } from "react";
import { Link } from "react-router";
import { ListenerSheet } from "~/components/ListenerSheet";
import { ProductReleaseNotes } from "~/components/ProductReleaseNotes";
import { APP_VERSION, CURRENT_RELEASE } from "~/data/product-releases";

export function AppVersionBadge() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="app-version-badge"
        aria-label={`SunSyn v${APP_VERSION}: view release notes`}
        aria-haspopup="dialog"
        title="What’s new at SunSyn"
        onClick={() => setOpen(true)}
      >
        v{APP_VERSION}
      </button>
      <ListenerSheet
        open={open}
        onClose={() => setOpen(false)}
        title="What’s new at SunSyn"
        closeLabel="Close release notes"
        className="product-release-dialog"
      >
        <ProductReleaseNotes release={CURRENT_RELEASE} current heading="h3" />
        <Link className="product-release-history-link" to="/updates" onClick={() => setOpen(false)}>
          View full release history <span aria-hidden="true">→</span>
        </Link>
      </ListenerSheet>
    </>
  );
}
