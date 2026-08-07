type ContainerProps = {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
};

export function Container({ children, wide, className }: ContainerProps) {
  return <div className={[wide ? "container container--wide" : "container", className].filter(Boolean).join(" ")}>{children}</div>;
}
