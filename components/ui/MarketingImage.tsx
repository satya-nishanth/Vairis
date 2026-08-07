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
  style?: React.CSSProperties;
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
  style,
}: MarketingImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={["img-placeholder", className].filter(Boolean).join(" ")}
        style={
          fill
            ? { position: "absolute", inset: 0, ...style }
            : { width: "100%", maxWidth: width, aspectRatio: `${width} / ${height}`, ...style }
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
        style={style}
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
      style={style}
      unoptimized
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
