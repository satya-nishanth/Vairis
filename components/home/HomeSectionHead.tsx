import { Button } from "@/components/ui/Button";

type HomeSectionHeadProps = {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  actionExternal?: boolean;
};

/** Centered landing section title; optional action aligns right on the same row. */
export function HomeSectionHead({ title, actionLabel, actionHref, actionExternal }: HomeSectionHeadProps) {
  const isExternal = actionExternal ?? (actionHref ? actionHref.startsWith("http") : false);
  return (
    <div className={`home-section-head${actionLabel ? " home-section-head--with-action" : ""}`}>
      <h2 className="home-section-head__title">{title}</h2>
      {actionLabel && actionHref && (
        <Button
          href={actionHref}
          variant="ghost"
          className="home-section-head__action"
          {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
