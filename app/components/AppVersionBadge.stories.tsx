import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppVersionBadge } from "./AppVersionBadge";
import { ProductReleaseHistory } from "./ProductReleaseNotes";

const meta = {
  title: "Production/Product updates",
  component: AppVersionBadge,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ padding: "var(--space-5)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppVersionBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const VersionBadge: Story = {};
export const LightTheme: Story = { globals: { theme: "light" } };
export const ReleaseHistory: Story = { render: () => <ProductReleaseHistory /> };
export const ReleaseHistoryLight: Story = {
  globals: { theme: "light" },
  render: () => <ProductReleaseHistory />,
};
