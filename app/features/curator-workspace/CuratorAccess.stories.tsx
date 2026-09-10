import type { Meta, StoryObj } from "@storybook/react-vite";

import { AccessGate } from "~/components/AccessGate";

function CuratorAccessPrototype({
  state = "signed-out",
}: {
  state?: "signed-out" | "expired" | "denied";
}) {
  const copy = {
    "signed-out": {
      eyebrow: "Curator workspace",
      heading: "Continue to curation",
      message:
        "Use your approved curator account. Cloudflare Access verifies your identity before the workspace opens.",
      action: "Continue securely",
    },
    expired: {
      eyebrow: "Session expired",
      heading: "Sign in again",
      message:
        "Your listening notes are safe. Re-authenticate to return to the track you were reviewing.",
      action: "Renew session",
    },
    denied: {
      eyebrow: "Curator access",
      heading: "This account is not approved",
      message: "The account is signed in but is not on the curator access list.",
      action: "Try another account",
    },
  }[state];

  return (
    <AccessGate
      context="curator"
      eyebrow={copy.eyebrow}
      heading={copy.heading}
      message={copy.message}
      action={
        <button type="button" className="access-gate__primary">
          {copy.action}
        </button>
      }
      secondaryAction={<a href="mailto:radio@sunsyn.art">Need access?</a>}
    />
  );
}

const meta = {
  title: "Curator Workspace/Access",
  component: CuratorAccessPrototype,
  parameters: { layout: "fullscreen" },
  args: { state: "signed-out" },
} satisfies Meta<typeof CuratorAccessPrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = { globals: { theme: "dark" } };
export const LightTheme: Story = { globals: { theme: "light" } };
export const SessionExpired: Story = { args: { state: "expired" } };
export const AccessDenied: Story = { args: { state: "denied" } };
