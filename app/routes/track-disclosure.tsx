import { Link } from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";

import type { Route } from "./+types/track-disclosure";

export async function loader({ context, params }: Route.LoaderArgs) {
  const { catalogueRepository } = context.get(cloudflareContext);
  const disclosure = await catalogueRepository.findPublicTrackDisclosure(
    params.releaseSlug,
    params.trackSlug,
  );
  if (!disclosure) {
    throw new Response("Disclosure not found.", { status: 404 });
  }
  return { disclosure };
}

export const meta: Route.MetaFunction = () => [
  { title: "Reviewed disclosure | Sunstruck Synapse Radio" },
];

export default function TrackDisclosureRoute({ loaderData }: Route.ComponentProps) {
  const { disclosure } = loaderData;
  return (
    <article className="entity-page">
      <p className="eyebrow">Reviewed disclosure</p>
      <h1>{disclosure.trackTitle}</h1>
      <p>
        {disclosure.artistName} · {disclosure.releaseTitle}
      </p>
      <p>Reviewed revision pinned at {new Date(disclosure.reviewedAt).toLocaleString()}.</p>
      <section>
        <h2>Rights</h2>
        <p>{disclosure.rights.publicSummary}</p>
        {disclosure.rights.publicNotes ? <p>{disclosure.rights.publicNotes}</p> : null}
        <p>Authority basis: {disclosure.rights.authorityBasis}</p>
        <p>Territories: {disclosure.rights.territories.join(", ") || "Not stated"}</p>
        {disclosure.rights.distributorName ? (
          <p>Distributor: {disclosure.rights.distributorName}</p>
        ) : null}
        {disclosure.rights.isrc ? <p>ISRC: {disclosure.rights.isrc}</p> : null}
      </section>
      <section>
        <h2>Creative process</h2>
        <p>{disclosure.process.publicSummary}</p>
        <p>{disclosure.process.meaningfulHumanContribution}</p>
        {disclosure.process.aiUseDescription ? <p>{disclosure.process.aiUseDescription}</p> : null}
        <ul>
          {disclosure.process.humanRoles.map((role, index) => (
            <li key={`${role.name}-${index}`}>
              {role.name}: {role.role} — {role.contribution}
            </li>
          ))}
        </ul>
        <ul>
          {disclosure.process.aiTools.map((tool, index) => (
            <li key={`${tool.name}-${index}`}>
              {tool.name}
              {tool.model ? ` (${tool.model})` : ""} — {tool.purpose}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Provenance</h2>
        <p>{disclosure.provenance.summary}</p>
        {disclosure.provenance.publicNotes ? <p>{disclosure.provenance.publicNotes}</p> : null}
        <ol>
          {disclosure.provenance.steps.map((step) => (
            <li key={`${step.position}-${step.processType}`}>
              {step.processType}: {step.description}
            </li>
          ))}
        </ol>
        <ul>
          {disclosure.provenance.sources.map((source, index) => (
            <li key={`${source.reference}-${index}`}>
              {source.sourceType}: {source.reference}
            </li>
          ))}
        </ul>
        <p>Private evidence references remain excluded from this public revision page.</p>
      </section>
      <Link to=".." relative="path">
        Back to track
      </Link>
    </article>
  );
}
