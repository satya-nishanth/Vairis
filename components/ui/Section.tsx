import { Button } from "./Button";

type SectionHeaderProps = {
  label?: string;
  title: string;
  actionLabel?: string;
  actionHref?: string;
};

export function SectionHeader({ label, title, actionLabel, actionHref }: SectionHeaderProps) {
  return (
    <div className="section__header">
      <h2 className="section__title">
        {label && <span className="section__label">{label} </span>}
        {title}
      </h2>
      {actionLabel && actionHref && (
        <Button href={actionHref} variant="ghost">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

type SectionProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
  background?: "page" | "card" | "muted";
  centeredTitle?: string;
  label?: string;
};

export function Section({ children, className, id, background, centeredTitle, label }: SectionProps) {
  const bg =
    background === "card"
      ? { background: "var(--bg-card)" }
      : background === "muted"
        ? { background: "var(--bg-muted)" }
        : undefined;

  return (
    <section id={id} className={["section", className].filter(Boolean).join(" ")} style={bg}>
      {centeredTitle && (
        <div className="container">
          <h2 className="section__title" style={{ textAlign: "center", marginBottom: label ? 48 : 32 }}>
            {label && <span className="section__label">{label} </span>}
            {centeredTitle}
          </h2>
        </div>
      )}
      {children}
    </section>
  );
}
