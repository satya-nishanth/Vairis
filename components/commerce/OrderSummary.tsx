import { formatPrice } from "@/lib/ui-data";
import { Button } from "@/components/ui/Button";

export type SummaryLine = {
  label: string;
  value: string;
};

type OrderSummaryProps = {
  title?: string;
  lines: SummaryLine[];
  total: number;
  totalLabel?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  showEmi?: boolean;
  showPromo?: boolean;
  editCartHref?: string;
};

export function OrderSummary({
  title = "Order Summary",
  lines,
  total,
  totalLabel = "Total",
  children,
  footer,
  showEmi,
  showPromo,
  editCartHref,
}: OrderSummaryProps) {
  return (
    <aside className="order-summary">
      <div style={editCartHref ? { display: "flex", justifyContent: "space-between", marginBottom: 16 } : undefined}>
        <h2>{title}</h2>
        {editCartHref && (
          <a href={editCartHref} style={{ fontSize: "0.8125rem" }}>
            Edit Cart
          </a>
        )}
      </div>
      {children}
      {lines.map((line) => (
        <div key={line.label} className="summary-row">
          <span>{line.label}</span>
          <span>{line.value}</span>
        </div>
      ))}
      <div className="summary-row summary-row--total">
        <span>{totalLabel}</span>
        <span>{formatPrice(total)}</span>
      </div>
      {showEmi && total > 0 && (
        <div className="summary-emi">
          EMI from ₹{Math.max(1, Math.round(total / 12)).toLocaleString("en-IN")}/month (12 mos) · No-cost EMI on select cards
        </div>
      )}
      {showPromo && (
        <div className="promo-field">
          <input type="text" placeholder="Apply code" />
          <button type="button">Apply</button>
        </div>
      )}
      {footer}
    </aside>
  );
}

export function SecureCheckoutButton() {
  return (
    <Button href="/checkout" variant="primary" full>
      🔒 Secure Checkout
    </Button>
  );
}
