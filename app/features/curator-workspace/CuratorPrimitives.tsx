import type { ButtonHTMLAttributes, ReactNode } from "react";

export type CuratorButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface CuratorButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CuratorButtonVariant;
}

export function CuratorButton({
  className = "",
  variant = "secondary",
  type = "button",
  ...props
}: CuratorButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`curator-button curator-button--${variant} ${className}`.trim()}
    />
  );
}

export type CuratorBadgeTone = "neutral" | "success" | "warning" | "info" | "danger";

export function CuratorBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: CuratorBadgeTone;
}) {
  return <span className={`curator-badge curator-badge--${tone}`}>{children}</span>;
}

export interface CuratorTabOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function CuratorTabs<T extends string>({
  active,
  label,
  onChange,
  options,
}: {
  active: T;
  label: string;
  onChange: (value: T) => void;
  options: readonly CuratorTabOption<T>[];
}) {
  return (
    <div className="curator-tabs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={option.id === active}
          className="curator-tab"
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.count === undefined ? null : <span>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function CuratorPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`curator-panel ${className}`.trim()}>{children}</section>;
}
