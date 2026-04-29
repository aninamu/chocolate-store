"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { ChevronRight, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildElementSnapshot,
  isInsideDevModeUi,
  useDevMode,
  type DevModeElementSnapshot,
} from "@/context/dev-mode";

type HoverHighlight = {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
};

const DEV_MODE_OUTLINE_BOX_SHADOW =
  "0 0 0 2px #f54e00, 0 0 0 4px rgba(245, 78, 0, 0.25)";

function DevModeHoverOutline({
  highlight,
}: {
  highlight: HoverHighlight | null;
}) {
  if (!highlight) {
    return null;
  }
  return (
    <div
      className="pointer-events-none fixed z-[59] rounded-sm"
      data-dev-mode-ui=""
      style={{
        top: highlight.top,
        left: highlight.left,
        width: highlight.width,
        height: highlight.height,
        boxShadow: DEV_MODE_OUTLINE_BOX_SHADOW,
      }}
      aria-hidden
    >
      <span className="absolute -top-6 left-0 rounded bg-[#f54e00] px-1.5 py-0.5 font-mono text-[0.7rem] font-medium text-white shadow-sm">
        {highlight.label}
      </span>
    </div>
  );
}

function DevModeSelectionOutline() {
  const { selected, selectedElementRef } = useDevMode();
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!selected) {
      setRect(null);
      return;
    }

    const readRect = () => {
      const el = selectedElementRef.current;
      if (el?.isConnected) {
        const r = el.getBoundingClientRect();
        setRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
        return;
      }
      setRect({
        top: selected.rect.top,
        left: selected.rect.left,
        width: selected.rect.width,
        height: selected.rect.height,
      });
    };

    readRect();
    const onScroll = () => readRect();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", readRect);

    const el = selectedElementRef.current;
    let ro: ResizeObserver | null = null;
    if (el?.isConnected && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => readRect());
      ro.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", readRect);
      ro?.disconnect();
    };
  }, [selected, selectedElementRef]);

  if (!selected || !rect) {
    return null;
  }

  return (
    <div
      data-dev-mode-ui=""
      className="pointer-events-none fixed z-[58] rounded-sm"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        boxShadow: DEV_MODE_OUTLINE_BOX_SHADOW,
      }}
      aria-hidden
    />
  );
}

const DEV_MODE_RAIL_WIDTH_REM = 18; // w-72

function MetadataSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className="text-foreground text-sm break-words">{children}</div>
    </section>
  );
}

function DevModeElementDetailsBody({ snapshot }: { snapshot: DevModeElementSnapshot }) {
  return (
    <div className="flex flex-col gap-4">
      <MetadataSection title="Tag & identity">
        <p>
          <code className="text-primary">&lt;{snapshot.tagName}&gt;</code>
          {snapshot.id && (
            <>
              {" "}
              <code className="text-xs">id=&quot;{snapshot.id}&quot;</code>
            </>
          )}
        </p>
        {snapshot.className && (
          <p className="text-muted-foreground text-xs break-all">
            {snapshot.className}
          </p>
        )}
      </MetadataSection>

      <MetadataSection title="Layout (getBoundingClientRect)">
        <pre className="bg-card-02/80 dark:bg-card-01/50 overflow-x-auto rounded border p-2 text-xs">
          {JSON.stringify(snapshot.rect, null, 2)}
        </pre>
      </MetadataSection>

      <MetadataSection title="Attributes">
        {snapshot.attributes.length === 0 ? (
          <p className="text-muted-foreground">None</p>
        ) : (
          <ul className="text-muted-foreground list-none space-y-1.5 pl-0 text-xs">
            {snapshot.attributes.map((a) => (
              <li key={a.name}>
                <code className="text-foreground">{a.name}</code>={" "}
                <span className="break-all">&quot;{a.value}&quot;</span>
              </li>
            ))}
          </ul>
        )}
      </MetadataSection>

      <MetadataSection title="Computed styles (subset)">
        <pre className="bg-card-02/80 dark:bg-card-01/50 max-h-48 overflow-auto rounded border p-2 text-xs">
          {Object.entries(snapshot.computed)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")}
        </pre>
      </MetadataSection>

      {snapshot.text && (
        <MetadataSection title="Text (trimmed)">
          <p className="text-muted-foreground line-clamp-6 break-all text-xs">
            {snapshot.text}
          </p>
        </MetadataSection>
      )}

      <MetadataSection title="outerHTML (truncated)">
        <pre className="bg-card-02/80 dark:bg-card-01/50 max-h-40 overflow-x-auto overflow-y-auto rounded border p-2 text-xs break-all whitespace-pre-wrap">
          {snapshot.outerHTML}
        </pre>
      </MetadataSection>
    </div>
  );
}

function elementInspectorKey(snapshot: DevModeElementSnapshot): string {
  return `${snapshot.domPath.join("/")}-${snapshot.rect.width}x${snapshot.rect.height}-${snapshot.outerHTML.slice(0, 80)}`;
}

function DevModeSelectedElementCollapsible({
  snapshot,
  onClear,
}: {
  snapshot: DevModeElementSnapshot;
  onClear: () => void;
}) {
  const pathTail =
    snapshot.domPath.length > 0
      ? snapshot.domPath.slice(-2).join(" › ")
      : snapshot.tagName;

  return (
    <details
      data-testid="dev-mode-element-details"
      className="group overflow-hidden"
    >
      <summary
        data-testid="dev-mode-element-details-summary"
        className={cn(
          "border-border/60 flex cursor-pointer list-none items-center gap-2 border-b bg-card-01/40 px-3 py-2.5 text-left backdrop-blur-sm [&::-webkit-details-marker]:hidden"
        )}
      >
        <ChevronRight
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90"
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-foreground flex flex-wrap items-baseline gap-x-1.5 font-mono text-xs font-medium">
            <code className="text-primary">&lt;{snapshot.tagName}&gt;</code>
            {snapshot.id ? (
              <span className="text-muted-foreground font-normal">
                #{snapshot.id}
              </span>
            ) : null}
            <span className="text-muted-foreground font-normal">
              · {snapshot.rect.width}×{snapshot.rect.height}px
            </span>
          </div>
          <p className="text-muted-foreground truncate text-[0.65rem] leading-tight">
            {pathTail}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Clear selection"
          data-testid="dev-mode-clear-selection"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
        >
          <XIcon className="size-4" />
        </Button>
      </summary>

      <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-3 py-4">
        <DevModeElementDetailsBody snapshot={snapshot} />
      </div>
    </details>
  );
}

function DevModeRightRail() {
  const { enabled, selected, setSelected } = useDevMode();

  useEffect(() => {
    if (!enabled) {
      document.body.style.paddingRight = "";
      return;
    }
    const railWidth = `${DEV_MODE_RAIL_WIDTH_REM}rem`;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      document.body.style.paddingRight = mq.matches ? railWidth : "";
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.body.style.paddingRight = "";
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <aside
      data-dev-mode-ui=""
      data-testid="dev-mode-rail"
      aria-label="Dev mode panel"
      className="bg-card/95 supports-backdrop-filter:bg-card/80 fixed top-0 right-0 z-[35] flex h-dvh w-72 flex-col overflow-hidden border-l border-border shadow-sm backdrop-blur-md max-md:hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="border-border/60 shrink-0 border-b"
          data-testid="dev-mode-rail-primary-slot"
          aria-label="Dev tools"
        />

        {selected != null ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div
              className="border-border bg-background/40 overflow-hidden rounded-lg border shadow-sm"
              data-testid="dev-mode-element-panel"
            >
              <DevModeSelectedElementCollapsible
                key={elementInspectorKey(selected)}
                snapshot={selected}
                onClear={() => setSelected(null)}
              />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function DevModeToggle() {
  const { enabled, setEnabled, agentStatus } = useDevMode();

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col items-center gap-1.5 rounded-2xl border border-border/40 bg-card/40 px-4 py-3 shadow-lg backdrop-blur-md supports-backdrop-filter:bg-card/30 max-md:hidden"
      data-dev-mode-ui=""
    >
      <label
        htmlFor="dev-mode-switch"
        className="cursor-pointer select-none text-xs text-muted-foreground/70"
      >
        Dev mode {enabled ? "on" : "off"}
      </label>
      {enabled ? (
        <span
          className="text-[0.65rem] text-muted-foreground/80"
          data-testid="dev-mode-agent-status"
        >
          {(agentStatus === "connecting" || agentStatus === "idle") &&
            "Agent: connecting…"}
          {agentStatus === "connected" && "Agent: connected"}
          {agentStatus === "error" && "Agent: error"}
        </span>
      ) : null}
      <button
        id="dev-mode-switch"
        type="button"
        role="switch"
        aria-checked={enabled}
        data-testid="dev-mode-toggle"
        className={cn(
          "relative h-7 w-12 shrink-0 cursor-pointer rounded-full border border-transparent shadow-md transition-colors duration-200 outline-none select-none",
          "focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.98]",
          enabled
            ? "bg-primary shadow-primary/20"
            : "bg-muted text-muted-foreground shadow-inner"
        )}
        onClick={() => setEnabled(!enabled)}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 size-6 rounded-full bg-card shadow-sm ring-1 ring-border/60 transition-transform duration-200 ease-out",
            enabled && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}

function DevModeInspector() {
  const { enabled, selected, setSelected } = useDevMode();
  const [hover, setHover] = useState<HoverHighlight | null>(null);
  const raf = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!enabledRef.current) return;
    if (isInsideDevModeUi(e.target)) {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      setHover(null);
      return;
    }
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
    }
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const t = e.target;
      if (!(t instanceof Element)) {
        setHover(null);
        return;
      }
      const r = t.getBoundingClientRect();
      setHover({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        label: t.tagName.toLowerCase(),
      });
    });
  }, []);

  const onClick = useCallback(
    (e: MouseEvent) => {
      if (!enabledRef.current) {
        return;
      }
      if (isInsideDevModeUi(e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const source =
        e.target instanceof Element
          ? e.target
          : e.target instanceof Text && e.target.parentElement != null
            ? e.target.parentElement
            : null;
      const snap = buildElementSnapshot(e.target);
      if (snap) {
        setSelected(snap, source);
      } else {
        setSelected(null);
      }
    },
    [setSelected]
  );

  useEffect(() => {
    if (!enabled) {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      setHover(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    document.addEventListener("mousemove", onMouseMove, { capture: true });
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("mousemove", onMouseMove, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [enabled, onClick, onMouseMove]);

  if (!enabled) {
    return null;
  }
  return (
    <>
      {selected != null ? (
        <DevModeSelectionOutline key={elementInspectorKey(selected)} />
      ) : null}
      <DevModeHoverOutline highlight={hover} />
    </>
  );
}

export function DevMode() {
  return (
    <>
      <DevModeRightRail />
      <DevModeToggle />
      <DevModeInspector />
    </>
  );
}
