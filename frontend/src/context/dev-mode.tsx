"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type DevModeElementAttribute = { name: string; value: string };

export type DevModeElementRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

export type DevModeElementSnapshot = {
  tagName: string;
  id: string;
  className: string;
  attributes: DevModeElementAttribute[];
  rect: DevModeElementRect;
  domPath: string[];
  text: string;
  computed: Record<string, string>;
  outerHTML: string;
};

const CURATED_COMPUTED_KEYS: readonly string[] = [
  "display",
  "position",
  "color",
  "background-color",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "z-index",
  "opacity",
  "visibility",
  "overflow",
];

function isInsideDevModeUi(node: EventTarget | null): boolean {
  if (node == null || !(node instanceof Node)) {
    return false;
  }
  if (node instanceof Element) {
    return node.closest("[data-dev-mode-ui]") != null;
  }
  if (node instanceof Text) {
    return node.parentElement?.closest("[data-dev-mode-ui]") != null;
  }
  return false;
}

function escapeCssIdent(value: string): string {
  if (typeof globalThis !== "undefined" && globalThis.CSS?.escape) {
    return globalThis.CSS.escape(value);
  }
  return value.replace(/([!"#$%&'()*+,.:;<=>?@\[\\\]^`{|}~])/g, "\\$1");
}

function getElementClassName(el: Element): string {
  if (el instanceof HTMLElement) {
    return typeof el.className === "string" ? el.className : "";
  }
  if (typeof SVGElement !== "undefined" && el instanceof SVGElement) {
    const c = el.className;
    if (typeof c === "string") return c;
    if (c && typeof c === "object" && "baseVal" in c) {
      return c.baseVal;
    }
  }
  return el.getAttribute("class") ?? "";
}

/**
 * One segment in the path: tag, optional #id, optional .class list, position among same-tag siblings.
 */
function buildPathSegment(node: Element): string {
  const tag = node.tagName.toLowerCase();
  const id = (node as HTMLElement).id
    ? `#${escapeCssIdent((node as HTMLElement).id)}`
    : "";
  const clsStr = getElementClassName(node);
  const classPart = clsStr.trim()
    ? clsStr
        .trim()
        .split(/\s+/)
        .map((c) => `.${escapeCssIdent(c)}`)
        .join("")
    : "";
  const parent = node.parentElement;
  let n = 1;
  if (parent) {
    for (const child of parent.children) {
      if (child === node) break;
      if (child.tagName === node.tagName) n += 1;
    }
  }
  const sameTagSiblings = parent
    ? Array.from(parent.children).filter(
        (c) => c.tagName === node.tagName
      ).length
    : 1;
  const nth = sameTagSiblings > 1 ? `:nth-of-type(${n})` : "";
  return `${tag}${id}${classPart}${nth}`;
}

/**
 * Build a path from the target up toward body / html, then reverse to root -> leaf.
 */
function buildDomPath(target: Element, maxDepth: number): string[] {
  const fromLeaf: string[] = [];
  let current: Element | null = target;
  let d = 0;
  while (current && d < maxDepth) {
    fromLeaf.push(buildPathSegment(current));
    if (current === document.body || current === document.documentElement) {
      break;
    }
    current = current.parentElement;
    d += 1;
  }
  return fromLeaf.reverse();
}

const OUTER_HTML_MAX = 500;
const TEXT_MAX = 200;

export function buildElementSnapshot(target: EventTarget | null): DevModeElementSnapshot | null {
  if (target == null) return null;
  if (!(target instanceof Element)) {
    if (target instanceof Text && target.parentElement) {
      return buildElementSnapshot(target.parentElement);
    }
    return null;
  }

  const el = target;
  const style = getComputedStyle(el);
  const computed: Record<string, string> = {};
  for (const key of CURATED_COMPUTED_KEYS) {
    try {
      const v = style.getPropertyValue(key);
      computed[key] = v;
    } catch {
      computed[key] = "";
    }
  }

  const rect = el.getBoundingClientRect();
  const attrs: DevModeElementAttribute[] = [];
  for (let i = 0; i < el.attributes.length; i += 1) {
    const a = el.attributes[i]!;
    attrs.push({ name: a.name, value: a.value });
  }

  const className = getElementClassName(el);
  const text = (el.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEXT_MAX);

  let rawOuter = "";
  if ("outerHTML" in el && typeof (el as HTMLElement).outerHTML === "string") {
    rawOuter = (el as HTMLElement).outerHTML;
  } else {
    try {
      rawOuter = new XMLSerializer().serializeToString(el);
    } catch {
      rawOuter = "";
    }
  }
  const outerHTML =
    rawOuter.length > OUTER_HTML_MAX
      ? `${rawOuter.slice(0, OUTER_HTML_MAX)}…`
      : rawOuter;

  return {
    tagName: el.tagName.toLowerCase(),
    id: (el as HTMLElement).id ?? "",
    className,
    attributes: attrs,
    rect: {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      bottom: Math.round(rect.bottom),
      right: Math.round(rect.right),
    },
    domPath: buildDomPath(el, 6),
    text,
    computed,
    outerHTML,
  };
}

export type DevModeAgentStatus = "idle" | "connecting" | "connected" | "error";

type DevModeContextValue = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  selected: DevModeElementSnapshot | null;
  setSelected: (snap: DevModeElementSnapshot | null) => void;
  isInsideDevModeUi: typeof isInsideDevModeUi;
  agentId: string | null;
  agentStatus: DevModeAgentStatus;
};

const DevModeContext = createContext<DevModeContextValue | null>(null);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [selected, setSelected] = useState<DevModeElementSnapshot | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] =
    useState<DevModeAgentStatus>("idle");
  const agentIdRef = useRef<string | null>(null);

  useEffect(() => {
    agentIdRef.current = agentId;
  }, [agentId]);

  useEffect(() => {
    if (!enabled) {
      const id = agentIdRef.current;
      setAgentId(null);
      setAgentStatus("idle");
      if (id) {
        void fetch("/api/dev-mode/agent", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: id }),
        }).catch(() => {
          /* ignore teardown network errors */
        });
      }
      return;
    }

    const ac = new AbortController();
    setAgentStatus("connecting");
    setAgentId(null);

    void (async () => {
      try {
        const res = await fetch("/api/dev-mode/agent", {
          method: "POST",
          signal: ac.signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          agentId?: string;
          error?: string;
        };
        if (ac.signal.aborted) {
          return;
        }
        if (!res.ok) {
          setAgentStatus("error");
          setAgentId(null);
          return;
        }
        if (typeof data.agentId === "string") {
          setAgentId(data.agentId);
          setAgentStatus("connected");
        } else {
          setAgentStatus("error");
        }
      } catch {
        if (!ac.signal.aborted) {
          setAgentStatus("error");
          setAgentId(null);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [enabled]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    if (!next) {
      setSelected(null);
    }
  }, []);

  const value = useMemo(
    () =>
      ({
        enabled,
        setEnabled,
        selected,
        setSelected,
        isInsideDevModeUi,
        agentId,
        agentStatus,
      }) satisfies DevModeContextValue,
    [agentId, agentStatus, enabled, selected, setEnabled]
  );

  return (
    <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>
  );
}

export function useDevMode(): DevModeContextValue {
  const context = useContext(DevModeContext);
  if (!context) {
    throw new Error("useDevMode must be used within DevModeProvider");
  }
  return context;
}

export { isInsideDevModeUi };
