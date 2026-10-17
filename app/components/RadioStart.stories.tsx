import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioStart } from "~/components/RadioStart";
import type { CatalogueItem } from "~/types/catalogue";
const track: CatalogueItem = {
  id: "story-radio-track",
  slug: "signal-in-bloom",
  href: "/tracks/story/signal-in-bloom",
  creator: {
    id: "story-artist",
    slug: "story-artist",
    name: "Story artist",
    role: "Artist",
    href: "/artists/story-artist",
  },
  release: { id: "story-release", slug: "story", title: "Story release", href: "/releases/story" },
  description: { title: "Signal in bloom", subtitle: "Story artist" },
  artwork: { src: "/assets/thumbs/thumb-02.svg", alt: "Story artwork" },
  mediaKind: "audio",
  media: {
    src: "/assets/audio/Sunstruck Synapse (Revolution will be televised).mp3",
    mimeType: "audio/mpeg",
  },
  durationMs: 295000,
};
const meta: Meta<typeof RadioStart> = {
  title: "Production/RadioStart",
  component: RadioStart,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="listener-shell">
        <div className="radio-home">
          <Story />
        </div>
      </div>
    ),
  ],
  args: { tracks: [track], onPlay: () => undefined },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const CuratedSelection: Story = {
  args: {
    collection: {
      id: "story-collection",
      slug: "evening-signals",
      name: "Evening signals",
      description: "A short selection chosen by our human editors.",
      items: [track],
    },
  },
};
export const CatalogueFallback: Story = {};
export const Empty: Story = { args: { tracks: [] } };
export const UnknownDuration: Story = { args: { tracks: [{ ...track, durationMs: undefined }] } };
export const LongEditorialText: Story = {
  args: {
    collection: {
      id: "story-long",
      slug: "long",
      name: "Signals from the very far edge of an unusually long and curious evening",
      description:
        "A longer published editorial note remains available on the collection page while the radio start stays compact on a phone.",
      items: [track],
    },
  },
};
export const LightTheme: Story = { ...CuratedSelection, globals: { theme: "light" } };
