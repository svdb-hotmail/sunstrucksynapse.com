import type { Meta, StoryObj } from "@storybook/react-vite";

const colorTokens = [
  ["--color-bg", "Canvas"],
  ["--color-surface-panel", "Panel"],
  ["--color-surface-shell", "Deep panel"],
  ["--color-surface-card", "Card"],
  ["--color-content-primary", "Text"],
  ["--color-content-secondary", "Muted text"],
  ["--color-border-subtle", "Subtle border"],
  ["--color-border-control", "Control border"],
  ["--color-accent-sun", "Sun accent"],
  ["--color-accent-pink", "Pink accent"],
  ["--color-accent-violet", "Violet accent"],
  ["--color-accent-cyan", "Cyan accent"],
  ["--color-accent-green", "Green accent"],
  ["--color-status-danger", "Danger status"],
  ["--color-focus-ring", "Focus ring"],
] as const;

const layoutTokens = [
  ["--space-1", "4px"],
  ["--space-2", "8px"],
  ["--space-3", "12px"],
  ["--space-4", "16px"],
  ["--space-5", "18px"],
  ["--space-6", "22px"],
  ["--space-7", "28px"],
  ["--space-8", "42px"],
] as const;

function TokenValue({ name }: { name: string }) {
  return (
    <code
      style={{
        display: "block",
        color: "var(--muted)",
        fontSize: "0.75rem",
        marginTop: "0.35rem",
      }}
    >
      {name}: <span style={{ color: "var(--text)" }}>var({name})</span>
    </code>
  );
}

function Foundations() {
  return (
    <main
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
        padding: "clamp(1.5rem, 5vw, 4rem)",
      }}
    >
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
        <p className="eyebrow">Design system</p>
        <h1 style={{ marginTop: 0 }}>Foundations</h1>
        <p style={{ color: "var(--muted)", maxWidth: "42rem" }}>
          The catalogue uses a small set of production CSS custom properties for colour, spacing,
          shape, and elevation. Use the theme control in the Storybook toolbar to inspect both
          supported surfaces.
        </p>

        <section aria-labelledby="colour-tokens" style={{ marginTop: "2.5rem" }}>
          <h2 id="colour-tokens">Colour tokens</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
              gap: "1rem",
            }}
          >
            {colorTokens.map(([name, label]) => (
              <article
                key={name}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    background: `var(${name})`,
                    borderRadius: "var(--radius-sm)",
                    height: "4rem",
                  }}
                />
                <strong style={{ display: "block", marginTop: "0.75rem" }}>{label}</strong>
                <TokenValue name={name} />
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="layout-tokens" style={{ marginTop: "2.5rem" }}>
          <h2 id="layout-tokens">Spacing scale</h2>
          <div style={{ display: "grid", gap: "0.5rem", maxWidth: "34rem" }}>
            {layoutTokens.map(([name, value]) => (
              <div key={name} style={{ alignItems: "center", display: "flex", gap: "1rem" }}>
                <span style={{ color: "var(--muted)", width: "4.5rem" }}>{value}</span>
                <span
                  aria-hidden="true"
                  style={{
                    background: "var(--cyan)",
                    borderRadius: "var(--radius-pill)",
                    display: "block",
                    height: "0.5rem",
                    width: `var(${name})`,
                  }}
                />
                <TokenValue name={name} />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="shape-tokens" style={{ marginTop: "2.5rem" }}>
          <h2 id="shape-tokens">Shape and elevation</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {(
              [
                ["--radius-sm", "Small radius"],
                ["--radius-md", "Medium radius"],
                ["--radius-lg", "Large radius"],
                ["--radius-pill", "Pill radius"],
              ] as const
            ).map(([name, label]) => (
              <div
                key={name}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: `var(${name})`,
                  boxShadow: "var(--shadow-card)",
                  padding: "1rem 1.25rem",
                }}
              >
                {label}
                <TokenValue name={name} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const meta = {
  title: "Design System/Foundations",
  component: Foundations,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A catalogue of the production SunSyn Radio tokens. Theme is controlled from the global Storybook toolbar.",
      },
    },
  },
} satisfies Meta<typeof Foundations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DarkTheme: Story = {
  globals: { theme: "dark" },
};

export const LightTheme: Story = {
  globals: { theme: "light" },
};
