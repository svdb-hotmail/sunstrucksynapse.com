import { showIdentityPreview, type IdentityTreatment } from "~/design-system/visual-identity";

export function IdentityPreviewControls({
  treatment,
  onChange,
}: {
  treatment: IdentityTreatment;
  onChange: (next: IdentityTreatment) => void;
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
    </div>
  );
}
