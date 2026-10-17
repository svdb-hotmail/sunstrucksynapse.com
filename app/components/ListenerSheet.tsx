import { useEffect, useId, useRef } from "react";

/** Keep children mounted: closing the panel must not replace the media element. */
export function ListenerSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (open)
      ref.current
        ?.querySelector<HTMLButtonElement>(".listener-sheet__heading button")
        ?.focus({ preventScroll: true });
  }, [open, title]);
  return (
    <dialog
      ref={ref}
      className="listener-sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="listener-sheet__heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close listening panel">
          ×
        </button>
      </div>
      <div className="listener-sheet__body">{children}</div>
    </dialog>
  );
}
