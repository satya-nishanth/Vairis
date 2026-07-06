type StepperStep = {
  label: string;
  state: "done" | "active" | "upcoming";
  number?: string;
};

type StepperProps = {
  steps: StepperStep[];
};

export function Stepper({ steps }: StepperProps) {
  return (
    <nav className="stepper" aria-label="Progress">
      {steps.map((step, index) => (
        <span key={step.label}>
          <span
            className={[
              "stepper__step",
              step.state === "active" ? "is-active" : "",
              step.state === "done" ? "is-done" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="stepper__num">{step.state === "done" ? "✓" : step.number ?? index + 1}</span>
            {step.label}
          </span>
          {index < steps.length - 1 && <span className="stepper__line" />}
        </span>
      ))}
    </nav>
  );
}
