import { ButtonBase, type ButtonBaseProps } from "./ButtonBase";

export type ButtonProps = ButtonBaseProps & {
  variant?: "primary" | "secondary";
};

/** Labelled general action. Use ToneButton for the original task-coloured actions. */
export function Button({
  variant = "secondary",
  busy,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <ButtonBase
      {...props}
      busy={busy}
      className={`brand-button-${variant} kb-system-button ${className}`}
    >
      {busy && <span className="kb-system-spinner" aria-hidden="true" />}
      {children}
    </ButtonBase>
  );
}
