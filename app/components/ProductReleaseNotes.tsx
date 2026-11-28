import { Link } from "react-router";
import { APP_VERSION, PRODUCT_RELEASES, type ProductRelease } from "~/data/product-releases";

export function ProductReleaseNotes({
  release,
  current = false,
  heading = "h2",
  permalink = false,
}: {
  release: ProductRelease;
  current?: boolean;
  heading?: "h2" | "h3";
  permalink?: boolean;
}) {
  const Heading = heading;
  const GroupHeading = heading === "h2" ? "h3" : "h4";
  const date = release.date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${release.date}T00:00:00Z`))
    : null;
  return (
    <article className="product-release" id={permalink ? `release-${release.version}` : undefined}>
      <header>
        <p className="product-release__meta">
          {permalink ? (
            <Link to={`/updates#release-${release.version}`}>v{release.version}</Link>
          ) : (
            <span className="product-release__version">v{release.version}</span>
          )}
          {release.date && date ? <time dateTime={release.date}>{date}</time> : null}
          {current ? <span className="product-release__current">Current version</span> : null}
        </p>
        <Heading>{release.title}</Heading>
        <p className="product-release__summary">{release.summary}</p>
      </header>
      <div className="product-release__groups">
        {release.groups.map((group) => (
          <section key={group.heading}>
            <GroupHeading>{group.heading}</GroupHeading>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

export function ProductReleaseHistory() {
  return (
    <article className="product-updates-page">
      <header className="product-updates-page__heading">
        <p className="eyebrow">SunSyn / Product updates</p>
        <h1>What’s new at SunSyn</h1>
        <p>New features, useful improvements and fixes, in plain language.</p>
        <p>
          Current version <strong>v{APP_VERSION}</strong>
        </p>
      </header>
      <section aria-labelledby="product-release-history-heading">
        <h2 id="product-release-history-heading">Release history</h2>
        <ol className="product-release-history">
          {PRODUCT_RELEASES.map((release, index) => (
            <li key={release.version}>
              <ProductReleaseNotes release={release} current={index === 0} heading="h3" permalink />
            </li>
          ))}
        </ol>
        <p className="product-release-history__beginning">
          This is the start of our numbered release history. Earlier changes were not assigned
          public version numbers.
        </p>
      </section>
    </article>
  );
}
