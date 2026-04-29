"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildElementSnapshot,
  isInsideDevModeUi,
  useDevMode,
  type DevModeElementSnapshot,
} from "@/context/dev-mode";

function isSheetOverlayNode(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) {
    return false;
  }
  if (node.getAttribute("data-slot") === "sheet-overlay") {
    return true;
  }
  return node.closest('[data-slot="sheet-overlay"]') != null;
}

type HoverHighlight = {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
};

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
        boxShadow: "0 0 0 2px #f54e00, 0 0 0 4px rgba(245, 78, 0, 0.25)",
      }}
      aria-hidden
    >
      <span className="absolute -top-6 left-0 rounded bg-[#f54e00] px-1.5 py-0.5 font-mono text-[0.7rem] font-medium text-white shadow-sm">
        {highlight.label}
      </span>
    </div>
  );
}

function DevModeToggle() {
  const { enabled, setEnabled } = useDevMode();
  const toggleRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = toggleRootRef.current;
    const innerWidth =
      typeof window !== "undefined" ? window.innerWidth : null;
    const mdUp =
      typeof window !== "undefined"
        ? window.matchMedia("(min-width: 768px)").matches
        : null;
    const display = el ? getComputedStyle(el).display : null;
    // #region agent log
    fetch("http://127.0.0.1:7843/ingest/a92391eb-c9da-446b-ba3a-cb0a95303651", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "cc8ea8",
      },
      body: JSON.stringify({
        sessionId: "cc8ea8",
        runId: "post-fix",
        hypothesisId: "A-B",
        location: "DevMode.tsx:DevModeToggle",
        message: "toggle wrapper computed display vs viewport",
        data: { innerWidth, mdUp, display },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  return (
    <div
      ref={toggleRootRef}
      className="fixed bottom-4 right-4 z-[60] max-md:hidden"
      data-dev-mode-ui=""
    >
      <Button
        data-testid="dev-mode-toggle"
        type="button"
        size="sm"
        variant={enabled ? "default" : "secondary"}
        className="pointer-events-auto shadow-md"
        aria-pressed={enabled}
        onClick={() => {
          setEnabled(!enabled);
        }}
      >
        {enabled ? "Dev mode on" : "Dev mode"}
      </Button>
    </div>
  );
}

function DevModeInspector() {
  const { enabled, setSelected } = useDevMode();
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
    if (isSheetOverlayNode(e.target)) {
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
      if (isSheetOverlayNode(e.target)) {
        setSelected(null);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setSelected(buildElementSnapshot(e.target));
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
  return <DevModeHoverOutline highlight={hover} />;
}

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

function formatDomPath(path: string[]): string {
  return path.join(" > ");
}

function DevModeSidebar() {
  const { selected, setSelected } = useDevMode();
  const open = selected != null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setSelected(null);
        }
      }}
      modal={false}
    >
      {selected ? (
        <DevModeSheetInner
          key={
            selected.tagName +
            selected.id +
            selected.outerHTML.slice(0, 24)
          }
          snapshot={selected}
        />
      ) : null}
    </Sheet>
  );
}

function DevModeSheetInner({ snapshot }: { snapshot: DevModeElementSnapshot }) {
  return (
    <SheetContent
      data-dev-mode-ui=""
      side="right"
      className="max-h-screen gap-0 overflow-y-auto p-0 sm:max-w-md"
      showCloseButton
    >
      <SheetHeader className="border-border/80 sticky top-0 z-[1] border-b bg-card/95 p-4 backdrop-blur supports-backdrop-filter:bg-card/80">
        <SheetTitle>Element</SheetTitle>
        <SheetDescription className="font-mono text-xs break-all text-muted-foreground">
          {formatDomPath(snapshot.domPath)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 p-4">
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
    </SheetContent>
  );
}

export function DevMode() {
  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7843/ingest/a92391eb-c9da-446b-ba3a-cb0a95303651", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "cc8ea8",
      },
      body: JSON.stringify({
        sessionId: "cc8ea8",
        runId: "pre-fix",
        hypothesisId: "C",
        location: "DevMode.tsx:DevMode",
        message: "DevMode subtree mounted",
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  return (
    <>
      <DevModeToggle />
      <DevModeInspector />
      <DevModeSidebar />
    </>
  );
}
