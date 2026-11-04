import type { ButtonHTMLAttributes } from "react";

export type ButtonBaseProps = ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean };

/** Behaviour only. Visual families own their appearance and accessible names. */
export function ButtonBase({ busy = false, disabled, type = "button", ...props }: ButtonBaseProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || props["aria-busy"]}
    />
  );
}
