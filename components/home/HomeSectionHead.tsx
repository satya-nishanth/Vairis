import { Button } from "@/components/ui/Button";

type HomeSectionHeadProps = {
  title: string;
  actionLabel?: string;
  actionHref?: string;
};

/** Centered landing section title; optional action aligns right on the same row. */
export function HomeSectionHead({ title, actionLabel, actionHref }: HomeSectionHeadProps) {
  return (
    <div className={`home-section-head${actionLabel ? " home-section-head--with-action" : ""}`}>
      <h2 className="home-section-head__title">{title}</h2>
      {actionLabel && actionHref && (
        <Button href={actionHref} variant="ghost" className="home-section-head__action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
