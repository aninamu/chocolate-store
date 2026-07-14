"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Product image with a branded fallback. When the remote image fails to load
 * (blocked host, 404, offline, etc.) we render an on-brand "chocolate bar"
 * placeholder instead of the browser's default broken-image glyph, so the UI
 * still looks intentional. Accepts all `next/image` props.
 */
export function ChocolateImage({
  src,
  alt,
  className,
  ...props
}: ImageProps) {
  const [failed, setFailed] = useState(false);

  // A new source should get another chance to load.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={typeof alt === "string" && alt ? alt : "Chocolate"}
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[oklch(0.44_0.09_54)] via-[oklch(0.35_0.07_48)] to-[oklch(0.26_0.05_44)]",
          className
        )}
      >
        <div
          aria-hidden
          className="grid aspect-square w-[42%] max-w-24 grid-cols-3 grid-rows-3 gap-[7%] rounded-[12%] bg-white/10 p-[8%] ring-1 ring-white/15"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="rounded-[20%] bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_2px_rgba(0,0,0,0.25)]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
