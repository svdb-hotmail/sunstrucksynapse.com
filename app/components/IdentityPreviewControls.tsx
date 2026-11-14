import { Link } from "react-router";
import { showIdentityPreview, type IdentityTreatment } from "~/design-system/visual-identity";
import type { Creator } from "~/types/catalogue";

export function IdentityPreviewControls({
  treatment,
  onChange,
  artists = [],
}: {
  treatment: IdentityTreatment;
  onChange: (next: IdentityTreatment) => void;
  artists?: Creator[];
}) {
  if (!showIdentityPreview) return null;
  return (
    <div className="identity-preview-controls" aria-label="Visual identity preview">
      <span>Visual study</span>
      <div role="group" aria-label="Visual treatment">
        {(["neutral", "palette", "expressive"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={treatment === option}
            onClick={() => onChange(option)}
          >
            {option === "palette" ? "Artwork palette" : option}
          </button>
        ))}
      </div>
      {artists.length > 1 ? (
        <nav aria-label="Preview artists">
          {artists.map((artist) => (
            <Link key={artist.id} to={artist.href}>
              {artist.name}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
