"use client";

import Image from "next/image";
import { useState } from "react";

type MarketingImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  placeholderLabel?: string;
  priority?: boolean;
  fill?: boolean;
};

export function MarketingImage({
  src,
  alt,
  width,
  height,
  className,
  placeholderLabel,
  priority,
  fill,
}: MarketingImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={["img-placeholder", className].filter(Boolean).join(" ")}
        style={
          fill
            ? { position: "absolute", inset: 0 }
            : { width: "100%", maxWidth: width, aspectRatio: `${width} / ${height}` }
        }
        role="img"
        aria-label={alt}
      >
        {placeholderLabel ?? alt}
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        unoptimized
        priority={priority}
        sizes="(max-width: 900px) 100vw, 55vw"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      unoptimized
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
