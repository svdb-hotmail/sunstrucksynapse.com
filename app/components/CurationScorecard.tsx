import { Form } from "react-router";

import { CURATION_RATIONALE_MAX_CHARACTERS } from "~/types/curation";

export interface CurationScorecardProps {
  submissionId: string;
  audio?: { id: string; filename: string; durationMs: number } | null;
  disabled?: boolean;
}

const criteria = [
  ["artisticQuality", "Artistic quality"],
  ["originalityIntent", "Originality & intent"],
  ["productionReadiness", "Production readiness"],
  ["editorialFit", "Editorial fit"],
] as const;

export function CurationScorecard({
  submissionId,
  audio = null,
  disabled = false,
}: CurationScorecardProps) {
  return (
    <section className="curation-scorecard" aria-labelledby={`scorecard-${submissionId}`}>
      <p className="eyebrow">Listen · assess · grade</p>
      <h4 id={`scorecard-${submissionId}`}>Editorial decision</h4>
      {audio ? (
        <div className="curation-listening-copy">
          <audio controls preload="metadata" src={`/curator/review-audio/${audio.id}`}>
            Your browser does not support audio playback.
          </audio>
          <small>
            {audio.filename} · {Math.round(audio.durationMs / 1000)} seconds · private
          </small>
        </div>
      ) : (
        <p role="status">Waiting for private review audio.</p>
      )}
      <Form method="post" className="curator-form">
        <input type="hidden" name="intent" value="grade" />
        <input type="hidden" name="submissionId" value={submissionId} />
        <div className="curation-score-grid">
          {criteria.map(([name, label]) => (
            <label key={name}>
              {label}
              <select name={name} defaultValue="3" required disabled={disabled || !audio}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <fieldset className="curation-grade-options" disabled={disabled || !audio}>
          <legend>Final grade</legend>
          <label>
            <input type="radio" name="finalGrade" value="A" required /> A · accept with feature
            distinction
          </label>
          <label>
            <input type="radio" name="finalGrade" value="B" /> B · accept
          </label>
          <label>
            <input type="radio" name="finalGrade" value="C" /> C · decline
          </label>
        </fieldset>
        <label>
          Decision rationale
          <textarea
            name="rationale"
            rows={3}
            required
            maxLength={CURATION_RATIONALE_MAX_CHARACTERS}
            disabled={disabled || !audio}
          />
        </label>
        <button type="submit" disabled={disabled || !audio}>
          Finalize decision
        </button>
        <p className="curation-grade-note">
          Scores are independent observations. The final grade is an explicit editorial judgment; no
          average or threshold is calculated. A distinction never publishes automatically.
        </p>
      </Form>
    </section>
  );
}
