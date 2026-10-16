import type { Meta, StoryObj } from "@storybook/react-vite";
import { CatalogueWorkspace } from "./CatalogueWorkspace";
import { fixtureCataloguePage, catalogueTrackFixtures } from "./catalogue-fixtures";
import { curatorIdentityFixture } from "./fixtures";

const query = { query: "", view: "all" as const, after: null, trackId: null };
const meta = {
  title: "Curator Workspace/Catalogue",
  component: CatalogueWorkspace,
  parameters: { layout: "fullscreen" },
  args: { identity: curatorIdentityFixture, query, page: fixtureCataloguePage(query) },
} satisfies Meta<typeof CatalogueWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Library: Story = {};
export const IncompletePublication: Story = {
  args: {
    query: { ...query, trackId: catalogueTrackFixtures[0].id },
    page: fixtureCataloguePage({ ...query, trackId: catalogueTrackFixtures[0].id }),
  },
};
export const EmptySearch: Story = {
  args: {
    query: { ...query, query: "no matching synthetic record" },
    page: fixtureCataloguePage({ ...query, query: "no matching synthetic record" }),
  },
};
