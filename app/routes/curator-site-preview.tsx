import { useRef, useState } from "react";
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
  type LoaderFunctionArgs,
} from "react-router";
import { CatalogueWorkspace } from "~/features/curator-workspace/CatalogueWorkspace";
import { fixtureCataloguePage } from "~/features/curator-workspace/catalogue-fixtures";
import { parseCatalogueQuery } from "~/services/curator-catalogue";
import { CuratorShell } from "~/features/curator-workspace/CuratorShell";
import { CuratorButton, CuratorPanel } from "~/features/curator-workspace/CuratorPrimitives";
import { SubmissionQueue, type QueueFilter } from "~/features/curator-workspace/SubmissionQueue";
import { SubmissionPreview } from "~/features/curator-workspace/SubmissionPreview";
import {
  ReviewWorkspace,
  type ReviewGrade,
  type ReviewScores,
} from "~/features/curator-workspace/ReviewWorkspace";
import { SubmissionEditor } from "~/features/curator-workspace/SubmissionEditor";
import { PublishingWorkspace } from "~/features/curator-workspace/PublishingWorkspace";
import {
  createCuratorQueueFixtures,
  curatorReviewFixture,
} from "~/features/curator-workspace/fixtures";
import type {
  CuratorNavigationItem,
  CuratorQueueItemView,
  CuratorSection,
} from "~/features/curator-workspace/types";
import type { SubmissionEditView } from "~/types/submission-edit";

const identity = { name: "Preview curator", email: "curator@example.test", initials: "PC" };
const navigation: CuratorNavigationItem[] = [
  { id: "queue", label: "Review submissions", href: "/curator/submissions" },
  { id: "catalogue", label: "Catalogue", href: "/curator" },
  { id: "collections", label: "Release preparation", href: "/curator/albums" },
  { id: "analytics", label: "Insights", href: "/curator/analytics" },
  { id: "settings", label: "Catalogue tools", href: "/curator/tools" },
];
const items = createCuratorQueueFixtures(20);
const emptyScores: ReviewScores = {
  artisticQuality: null,
  originalityIntent: null,
  productionReadiness: null,
  editorialFit: null,
};

export function loader({ request }: LoaderFunctionArgs) {
  if (import.meta.env.MODE !== "site-preview") throw new Response("Not found.", { status: 404 });
  const url = new URL(request.url);
  const path = url.pathname.replace(/\.data$/, "");
  const paths = [
    "/curator",
    "/curator/",
    "/curator/submissions",
    "/curator/albums",
    "/curator/analytics",
    "/curator/tools",
  ];
  if (!paths.includes(path) && !/^\/curator\/submissions\/[^/]+\/edit$/.test(path)) {
    throw new Response("Not found.", { status: 404 });
  }
  const query = parseCatalogueQuery(url.searchParams);
  return { query, catalogue: fixtureCataloguePage(query) };
}
export const meta = () => [{ title: "Curator design preview | SunSyn Radio" }];

function PreviewShell({
  section,
  children,
}: {
  section: CuratorSection;
  children: React.ReactNode;
}) {
  return (
    <CuratorShell activeSection={section} identity={identity} navigation={navigation}>
      {children}
    </CuratorShell>
  );
}

function QueuePreview() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(items[0].id);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);
  const completed = (item: CuratorQueueItemView) =>
    ["accepted", "rejected", "withdrawn"].includes(item.status);
  const matches = (item: CuratorQueueItemView, value: QueueFilter) =>
    value === "all" ||
    (value === "ready" && item.readiness === "ready" && !completed(item)) ||
    (value === "mine" && item.assignedCuratorName !== null) ||
    (value === "needs_audio" && item.readiness === "needs_audio") ||
    (value === "flagged" && (item.readiness === "flagged" || item.rights !== "attested")) ||
    (value === "completed" && completed(item));
  const filterCounts = Object.fromEntries(
    (["all", "ready", "mine", "needs_audio", "flagged", "completed"] as const).map((value) => [
      value,
      items.filter((item) => matches(item, value)).length,
    ]),
  ) as Record<QueueFilter, number>;
  const visible = items.filter(
    (item) =>
      matches(item, filter) &&
      `${item.title} ${item.artistName} ${item.publicReference}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const review = (item: CuratorQueueItemView) =>
    navigate(`/curator/submissions?review=${encodeURIComponent(item.id)}`);
  async function toggle(item: CuratorQueueItemView) {
    if (!audio.current || !item.audioUrl) return;
    setError(null);
    if (playing === item.id) {
      audio.current.pause();
      setPlaying(null);
      return;
    }
    audio.current.src = item.audioUrl;
    try {
      await audio.current.play();
      setPlaying(item.id);
    } catch {
      setError("The sample recording could not start. Try again.");
    }
  }
  return (
    <CuratorShell
      activeSection="queue"
      identity={identity}
      navigation={navigation}
      onSearch={setQuery}
      searchValue={query}
    >
      <audio ref={audio} onEnded={() => setPlaying(null)} />
      <header className="curator-page-heading">
        <div>
          <p className="curator-overline">Sample curation workspace</p>
          <h1>Submission queue</h1>
          <p>{items.length} sample submissions · no production records</p>
        </div>
        <CuratorButton
          variant="primary"
          onClick={() => review(items.find((item) => item.readiness === "ready")!)}
        >
          Review next ready submission →
        </CuratorButton>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <div className="curator-queue-layout">
        <SubmissionQueue
          items={visible}
          activeFilter={filter}
          filterCounts={filterCounts}
          selectedId={selectedId}
          playingId={playing}
          onFilterChange={setFilter}
          onSelect={(item) => setSelectedId(item.id)}
          onTogglePlayback={toggle}
        />
        <SubmissionPreview
          item={selected}
          isPlaying={selected?.id === playing}
          onOpenReview={review}
          onTogglePlayback={toggle}
        />
      </div>
    </CuratorShell>
  );
}

function ReviewPreview({ item }: { item: CuratorQueueItemView }) {
  const [scores, setScores] = useState<ReviewScores>(emptyScores);
  const [grade, setGrade] = useState<ReviewGrade | null>(null);
  const [rationale, setRationale] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  return (
    <PreviewShell section="queue">
      <header className="curator-page-heading">
        <div>
          <p className="curator-overline">Sample review · browser session only</p>
          <h1>Review submission</h1>
        </div>
        <Link to={`/curator/submissions/${item.id}/edit`} className="curator-button">
          Edit sample metadata
        </Link>
      </header>
      <ReviewWorkspace
        review={{ ...curatorReviewFixture, submission: item }}
        scores={scores}
        grade={grade}
        rationale={rationale}
        notice={notice}
        onScore={(criterion, score) => setScores((current) => ({ ...current, [criterion]: score }))}
        onGrade={setGrade}
        onRationale={setRationale}
        onLater={() => navigate("/curator/submissions")}
        onAskArtist={() => setNotice("Preview only: no message was sent.")}
        onFinish={() => setNotice("Preview only: no review decision was recorded.")}
        onFinishAndPublish={() => setNotice("Preview only: nothing was recorded or published.")}
      />
    </PreviewShell>
  );
}

function EditorPreview({ item }: { item: CuratorQueueItemView }) {
  const [notice, setNotice] = useState(false);
  const data: SubmissionEditView = {
    id: item.id,
    reference: item.publicReference,
    status: "accepted",
    artistName: item.artistName,
    trackId: "sample-track",
    releaseId: "sample-release",
    revision: "sample",
    editable: true,
    coverUrl: "/assets/thumbs/thumb-01.svg",
    fields: {
      title: item.title,
      releaseTitle: "Sample release",
      summary: "Sample catalogue data for design review.",
      genres: [],
      moods: [],
      processTags: [],
    },
  };
  return (
    <PreviewShell section="queue">
      <header className="curator-page-heading">
        <h1>Edit sample submission</h1>
        <Link to="/curator/submissions">Back to submissions</Link>
      </header>
      {notice ? <p role="status">Preview only: changes were not uploaded or saved.</p> : null}
      <SubmissionEditor data={data} onSave={() => setNotice(true)} />
    </PreviewShell>
  );
}

function PublishingPreview() {
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(false);
  return (
    <PreviewShell section="collections">
      <header className="curator-page-heading">
        <div>
          <p className="curator-overline">Sample release preparation</p>
          <h1>Release preparation</h1>
        </div>
        <CuratorButton onClick={() => setReady(!ready)}>
          Show {ready ? "preparing" : "ready"} state
        </CuratorButton>
      </header>
      {notice ? <p role="status">Preview only: no release was published.</p> : null}
      <PublishingWorkspace
        title="Night Signals"
        artistName="Kairos Bloom"
        releaseKind="album"
        coverPreviewUrl="/assets/thumbs/thumb-01.svg"
        encodingAvailable={true}
        tracks={["First Light", "Midnight Frequency", "Last Signal"].map((title, index) => ({
          id: `sample-${index}`,
          title,
          position: index + 1,
          genre: "Ambient",
          genres: ["Ambient", "Electronic"],
          moods: ["Reflective"],
          processTags: ["Human composition"],
          preparationStatus: ready ? "ready" : "queued",
          coverId: "sample-cover",
          failureCode: null,
        }))}
        readiness={
          ready
            ? []
            : [
                {
                  id: "sample-release",
                  title: "Night Signals",
                  blockers: ["Sample streaming preparation in progress"],
                },
              ]
        }
        onPublish={() => setNotice(true)}
        onRetry={() => setReady(true)}
        onRefresh={() => setReady(true)}
      />
    </PreviewShell>
  );
}

export default function CuratorSitePreview() {
  const { catalogue, query } = useLoaderData<typeof loader>();
  const location = useLocation();
  const id = new URLSearchParams(location.search).get("review");
  const selected = items.find((item) => item.id === id) ?? items[0];
  if (location.pathname.endsWith("/edit")) {
    const itemId = location.pathname.split("/").at(-2);
    return (
      <EditorPreview key={itemId} item={items.find((item) => item.id === itemId) ?? items[0]} />
    );
  }
  if (location.pathname === "/curator/submissions")
    return id ? <ReviewPreview key={id} item={selected} /> : <QueuePreview />;
  if (location.pathname === "/curator/albums") return <PublishingPreview />;
  if (["/curator/analytics", "/curator/tools"].includes(location.pathname))
    return (
      <PreviewShell section={location.pathname.endsWith("analytics") ? "analytics" : "settings"}>
        <header className="curator-page-heading">
          <h1>{location.pathname.endsWith("analytics") ? "Insights" : "Catalogue tools"}</h1>
        </header>
        <CuratorPanel>
          <p>
            Live analytics and catalogue administration require authenticated staging. This preview
            has no production connection.
          </p>
          <Link to="/curator/submissions">
            Inspect the sample submission and review workspace →
          </Link>
        </CuratorPanel>
      </PreviewShell>
    );
  return <CatalogueWorkspace page={catalogue} query={query} identity={identity} />;
}
