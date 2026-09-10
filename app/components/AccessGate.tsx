import type { ReactNode } from "react";

import { ProductBrand } from "~/components/ProductBrand";
import { ThemeToggle } from "~/design-system/ThemeToggle";

interface AccessGateProps {
  action: ReactNode;
  context: "listener" | "curator";
  eyebrow: string;
  heading: string;
  message: string;
  secondaryAction?: ReactNode;
}

export function AccessGate({
  action,
  context,
  eyebrow,
  heading,
  message,
  secondaryAction,
}: AccessGateProps) {
  return (
    <main className="access-gate">
      <header className="access-gate__header">
        <ProductBrand
          destination={context === "curator" ? "/curator/submissions" : "/"}
          context={context}
        />
        <ThemeToggle />
      </header>
      <section className="access-gate__panel" aria-labelledby="access-gate-title">
        <span className="access-gate__mark" aria-hidden="true">
          {context === "curator" ? "◇" : "☼"}
        </span>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="access-gate-title">{heading}</h1>
        <p>{message}</p>
        <div className="access-gate__actions">
          {action}
          {secondaryAction}
        </div>
      </section>
    </main>
  );
}
