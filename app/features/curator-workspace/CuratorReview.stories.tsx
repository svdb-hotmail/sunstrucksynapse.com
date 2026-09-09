import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CuratorShell } from "./CuratorShell";
import {
  createCuratorQueueFixtures,
  curatorIdentityFixture,
  curatorNavigationFixture,
  curatorReviewFixture,
} from "./fixtures";
import {
  ReviewWorkspace,
  type ReviewCriterion,
  type ReviewGrade,
  type ReviewScores,
} from "./ReviewWorkspace";

const emptyScores: ReviewScores = {
  artisticQuality: null,
  originalityIntent: null,
  productionReadiness: null,
  editorialFit: null,
};

const reviewQueue = createCuratorQueueFixtures(20).filter(
  (submission) => submission.readiness === "ready" && submission.audioUrl,
);

function ReviewPrototype() {
  const [queueIndex, setQueueIndex] = useState(0);
  const [scores, setScores] = useState<ReviewScores>(emptyScores);
  const [grade, setGrade] = useState<ReviewGrade | null>(null);
  const [rationale, setRationale] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const submission = reviewQueue[queueIndex % reviewQueue.length]!;
  const review = useMemo(() => ({ ...curatorReviewFixture, submission }), [submission]);

  const advance = (message: string) => {
    setNotice(message);
    setQueueIndex((current) => (current + 1) % reviewQueue.length);
    setScores(emptyScores);
    setGrade(null);
    setRationale("");
  };

  return (
    <CuratorShell
      activeSection="mine"
      identity={curatorIdentityFixture}
      navigation={curatorNavigationFixture}
      searchPlaceholder="Search the review queue"
    >
      <header className="curator-page-heading curator-page-heading--review">
        <div>
          <p className="curator-overline">Focused review</p>
          <p>
            Ready queue · {queueIndex + 1} of {reviewQueue.length}
          </p>
        </div>
      </header>
      <ReviewWorkspace
        key={submission.id}
        grade={grade}
        notice={notice}
        rationale={rationale}
        review={review}
        scores={scores}
        onAskArtist={(_claimKey, question) =>
          advance(`Question queued for ${submission.artistName}: “${question}”`)
        }
        onFinish={() =>
          advance(`${grade ?? "Decision"} recorded for “${submission.title}”. Next track loaded.`)
        }
        onGrade={setGrade}
        onLater={() => advance(`“${submission.title}” moved later in the ready queue.`)}
        onRationale={setRationale}
        onScore={(criterion: ReviewCriterion, score: number) =>
          setScores((current) => ({ ...current, [criterion]: score }))
        }
      />
    </CuratorShell>
  );
}

const meta = {
  title: "Curator Workspace/Review/Interactive prototype",
  component: ReviewPrototype,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ReviewPrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = { globals: { theme: "dark" } };
export const LightTheme: Story = { globals: { theme: "light" } };
