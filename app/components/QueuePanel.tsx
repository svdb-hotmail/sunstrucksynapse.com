import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QueueEntry } from "~/types/catalogue";

export function QueuePanel({
  open,
  onClose,
  queue,
  history,
  onClearHistory,
  feedback,
  children,
}: {
  open: boolean;
  onClose: () => void;
  queue: QueueEntry[];
  history: QueueEntry[];
  onClearHistory: () => void;
  feedback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [height, setHeight] = useState(320);
  const [bottom, setBottom] = useState(0);
  const [list, setList] = useState<"queue" | "history">("queue");
  const content = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const drag = useRef<{ y: number; height: number; moved: boolean } | null>(null);
  const previous = useRef(new Set(queue.map((entry) => entry.itemId)));
  const suppressClick = useRef(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!open || !mounted) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      if (
        !panel.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      )
        return;
      const fallback = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".mobile-tabs button[aria-label^='Queue,'], .desktop-nav button[aria-label^='Queue,'], .dock-desktop-queue",
        ),
      ).find((element) => element.getClientRects().length > 0);
      const target = opener.current?.isConnected ? opener.current : fallback;
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    };
  }, [open, mounted]);
  useEffect(() => {
    const update = () => {
      const dock = document.querySelector(".player-dock");
      const nav = document.querySelector(".mobile-tabs");
      const dockBox = dock?.getBoundingClientRect();
      const dockTop = dockBox && dockBox.height > 0 ? dockBox.top : window.innerHeight;
      const navBox = nav?.getBoundingClientRect();
      const navTop = navBox && navBox.height > 0 ? navBox.top : window.innerHeight;
      setBottom(Math.max(0, window.innerHeight - Math.min(dockTop, navTop)));
    };
    const observer = new ResizeObserver(update);
    document.querySelectorAll(".player-dock, .mobile-tabs").forEach((e) => observer.observe(e));
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [mounted]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 760px)");
    const update = () => {
      document.documentElement.style.setProperty(
        "--queue-clearance",
        open && mobile.matches ? `${Math.min(height, window.innerHeight - bottom - 16)}px` : "0px",
      );
      document.documentElement.style.setProperty("--queue-bottom", `${bottom}px`);
      document.body.dataset.queueSidebar = String(open && !mobile.matches);
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--queue-clearance");
      delete document.body.dataset.queueSidebar;
    };
  }, [open, height, bottom]);
  useEffect(() => {
    const added = queue.some((entry) => !previous.current.has(entry.itemId));
    previous.current = new Set(queue.map((entry) => entry.itemId));
    if (open && added)
      requestAnimationFrame(() => {
        const el = content.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
  }, [queue, open]);
  if (!mounted) return null;
  const max = Math.max(56, window.innerHeight - bottom - 16);
  return createPortal(
    <section ref={panel} className="queue-pullout" hidden={!open} aria-label="Listening queue">
      <header className="queue-pullout-header">
        <div className="queue-pullout-tabs" role="tablist" aria-label="Listening lists">
          <button role="tab" aria-selected={list === "queue"} onClick={() => setList("queue")}>
            Queue
          </button>
          <button role="tab" aria-selected={list === "history"} onClick={() => setList("history")}>
            History <span>{history.length}</span>
          </button>
        </div>
        <button
          className="queue-pullout-handle"
          aria-label="Resize queue; click to close"
          aria-expanded={open}
          onClick={() => {
            if (!suppressClick.current) onClose();
            suppressClick.current = false;
          }}
          onPointerDown={(e) => {
            suppressClick.current = false;
            drag.current = { y: e.clientY, height, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const delta = d.y - e.clientY;
            if (Math.abs(delta) > 6) d.moved = true;
            if (d.moved) {
              suppressClick.current = true;
              setHeight(Math.max(56, Math.min(max, d.height + delta)));
            }
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (d?.moved && d.height + d.y - e.clientY < 100) {
              onClose();
              setHeight(320);
            }
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
            suppressClick.current = true;
          }}
          onKeyDown={(e) => {
            if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              setHeight(
                e.key === "Home"
                  ? 56
                  : e.key === "End"
                    ? max
                    : Math.max(56, Math.min(max, height + (e.key === "ArrowUp" ? 32 : -32))),
              );
            }
          }}
        >
          <span className="queue-pullout-grabber" />
          <span aria-hidden="true">⌄</span>
        </button>
        <button className="queue-pullout-close" onClick={onClose} aria-label="Close queue">
          →
        </button>
      </header>
      <div className="queue-pullout-feedback">{feedback}</div>
      <div ref={content} className="queue-pullout-content">
        {list === "queue" ? (
          <>{children}</>
        ) : (
          <section className="queue queue-history-section">
            <div className="queue-head">
              <h2>History</h2>
              <button type="button" onClick={onClearHistory} disabled={history.length === 0}>
                Clear all
              </button>
            </div>
            {history.length ? (
              <ol className="queue-history" aria-label="Session history">
                {[...history].reverse().map((entry, index) => (
                  <li key={`${entry.itemId}-${index}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{entry.title}</strong>
                      <em>{entry.subtitle}</em>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="queue-empty">Tracks you finish listening to will appear here.</p>
            )}
          </section>
        )}
      </div>
    </section>,
    document.body,
  );
}
