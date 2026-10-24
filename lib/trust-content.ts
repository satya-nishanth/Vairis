export const trustBarItems = [
  { label: "IGI Certified Diamonds", id: "diamond-certification", icon: { name: "igi_certified", category: "brand" as const } },
  { label: "BIS Hallmarked Gold", id: "gold-hallmarking", icon: { name: "bis_hallmark", category: "brand" as const } },
  { label: "Insured Shipping", id: "insured-delivery", icon: { name: "insured_shipping", category: "brand" as const } },
  { label: "Secure Payments", id: "secure-payments", icon: { name: "secure_payments", category: "brand" as const } },
  { label: "Easy Returns", id: "returns-exchange", icon: { name: "easy_returns", category: "brand" as const } },
  { label: "Lifetime Support", id: "lifetime-support", icon: { name: "lifetime_support", category: "brand" as const } },
] as const;

const serviceAnchors: Record<string, string> = {
  "igi certified diamonds": "diamond-certification",
  "certified & authentic": "diamond-certification",
  "100% certified jewellery": "diamond-certification",
  "certified & quality checked": "diamond-certification",
  "bis hallmarked gold": "gold-hallmarking",
  "insured shipping": "insured-delivery",
  "free insured shipping": "insured-delivery",
  "insured delivery": "insured-delivery",
  "secure payments": "secure-payments",
  "easy returns": "returns-exchange",
  "lifetime support": "lifetime-support",
  "lifetime care plans": "lifetime-support",
  "lifetime care": "lifetime-support",
  "no showroom markups": "vairis-way",
  "transparent pricing": "diamond-pricing",
  "made for everyday": "vairis-way",
  "easy returns & lifetime support": "returns-exchange",
  "dna diamond": "dna-diamond",
};

export function serviceHrefForLabel(label: string): string {
  return `/our-services#${serviceAnchors[label.trim().toLowerCase()] ?? "service-overview"}`;
}
