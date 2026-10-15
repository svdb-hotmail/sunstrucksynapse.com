import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import {
  PublishingWorkspace,
  type PreparedTrack,
} from "../../app/features/curator-workspace/PublishingWorkspace";
import { SubmissionEditor } from "../../app/features/curator-workspace/SubmissionEditor";
const track: PreparedTrack = {
  id: "track-ready",
  title: "Ready track",
  position: 1,
  genre: "Ambient",
  moods: ["Calm"],
  processTags: ["Mixing"],
  preparationStatus: "ready",
  coverId: "cover",
  failureCode: null,
};
it("loads a prepared track into the publishing player's main Play control on first render", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PublishingWorkspace
        title="Release"
        artistName="Artist"
        releaseKind="album"
        tracks={[{ ...track, id: "not-ready", preparationStatus: "queued" }, track]}
        readiness={[]}
        encodingAvailable
        onPublish={() => {}}
        onRetry={() => {}}
        onRefresh={() => {}}
      />
    </MemoryRouter>,
  );
  expect(html).toMatch(
    /<audio[^>]*src="\/curator\/prepared-audio\/track-ready"[^>]*preload="metadata"/,
  );
});
it("keeps the saved server cover visible while loader revalidation is still pending", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <SubmissionEditor
        data={{
          id: "submission",
          reference: "SUB-1",
          status: "accepted",
          artistName: "Artist",
          trackId: "track",
          releaseId: "release",
          revision: "old",
          editable: true,
          coverUrl: null,
          fields: {
            title: "Track",
            releaseTitle: "Release",
            summary: "",
            genres: [],
            moods: [],
            processTags: [],
          },
        }}
        savedRevision="new"
        savedCoverUrl="/curator/submissions/submission/artwork?v=cover"
        onSave={() => {}}
      />
    </MemoryRouter>,
  );
  expect(html).toContain('src="/curator/submissions/submission/artwork?v=cover"');
  expect(html).not.toContain("No cover supplied.");
});
