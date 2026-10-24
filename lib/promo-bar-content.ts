type PromoBarIcon = {
  name: string;
  category: "brand";
};

export type PromoBarItem = {
  label: string;
  icon: PromoBarIcon;
};

export const utilityBarItems: PromoBarItem[] = [
  { label: "100% Certified Jewellery", icon: { name: "igi_certified", category: "brand" } },
  { label: "Free Insured Shipping", icon: { name: "insured_shipping", category: "brand" } },
  { label: "Easy Returns", icon: { name: "easy_returns", category: "brand" } },
  { label: "Lifetime Support", icon: { name: "lifetime_support", category: "brand" } },
];

export const announcementBarItems: PromoBarItem[] = [
  { label: "IGI Certified Diamonds", icon: { name: "igi_certified", category: "brand" } },
  { label: "BIS Hallmarked Gold", icon: { name: "bis_hallmark", category: "brand" } },
  { label: "Insured Shipping", icon: { name: "insured_shipping", category: "brand" } },
  { label: "Easy Returns", icon: { name: "easy_returns", category: "brand" } },
  { label: "Lifetime care plans", icon: { name: "lifetime_support", category: "brand" } },
];
