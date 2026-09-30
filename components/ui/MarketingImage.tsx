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
  fallbackSrc?: string;
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
  fallbackSrc,
  priority,
  fill,
  style,
}: MarketingImageProps) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setCurrentSrc(src);
    setFailed(false);
  }

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setFailed(true);
    }
  };

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
        {placeholderLabel ?? null}
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={currentSrc}
        alt={alt}
        fill
        className={className}
        style={style}
        unoptimized
        priority={priority}
        sizes="(max-width: 900px) 100vw, 55vw"
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      unoptimized
      priority={priority}
      onError={handleError}
    />
  );
}
