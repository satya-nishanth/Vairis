import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

type BaseProps = {
  variant?: ButtonVariant;
  size?: "default" | "sm";
  full?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = BaseProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof BaseProps> & {
    href?: undefined;
  };

type ButtonAsLink = BaseProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof BaseProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function classes(variant: ButtonVariant, size: "default" | "sm", full?: boolean, extra?: string) {
  return [
    "btn",
    variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : "btn-ghost",
    size === "sm" ? "btn--sm" : "",
    full ? "btn--full" : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "default", full, className, children, ...rest } = props;
  const cn = classes(variant, size, full, className);

  if ("href" in props && props.href) {
    const { href, ...linkRest } = rest as ButtonAsLink;
    return (
      <Link href={href} className={cn} {...linkRest}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={cn} {...(rest as ButtonAsButton)}>
      {children}
    </button>
  );
}
