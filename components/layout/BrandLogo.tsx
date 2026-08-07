import Image from "next/image";
import { LOGO_SRC } from "@/lib/logo";

type BrandLogoProps = {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

export function BrandLogo({
  className = "logo__img",
  width = 200,
  height = 64,
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt="VAIRIS - Everyday Diamond Wear"
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
