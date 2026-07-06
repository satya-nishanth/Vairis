import Image from "next/image";

type ProductImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  style?: React.CSSProperties;
};

export function ProductImage({ src, alt, width, height, className, fill, priority, style }: ProductImageProps) {
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
        sizes="(max-width: 767px) 50vw, (max-width: 1200px) 33vw, 25vw"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 800}
      height={height ?? 800}
      className={className}
      style={style}
      unoptimized
      priority={priority}
    />
  );
}
