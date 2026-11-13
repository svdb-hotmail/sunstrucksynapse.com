import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QueueEntry } from "~/types/catalogue";

export function QueuePanel({
  open,
  onClose,
  queue,
  children,
}: {
  open: boolean;
  onClose: () => void;
  queue: QueueEntry[];
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [height, setHeight] = useState(320);
  const [bottom, setBottom] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number; moved: boolean } | null>(null);
  const previous = useRef(new Set(queue.map((entry) => entry.itemId)));
  const suppressClick = useRef(false);
  useEffect(() => {
    setMounted(true);
  }, []);
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
    <section className="queue-pullout" hidden={!open} aria-label="Listening queue">
      <button className="queue-pullout-close" onClick={onClose} aria-label="Close queue">
        →
      </button>
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
      <div ref={content} className="queue-pullout-content">
        {children}
      </div>
    </section>,
    document.body,
  );
}
