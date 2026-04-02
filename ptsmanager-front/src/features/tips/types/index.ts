export type RegionalTipCategory =
  | "Transport"
  | "Energy"
  | "Groceries"
  | "Lifestyle"
  | "Housing"
  | "Utilities"
  | "Entertainment"
  | "Health"
  | "Subscriptions"
  | "Income";

export interface RegionalTip {
  id: string;
  title: string;
  description: string;
  impact: "High" | "Medium" | "Low";
  category: RegionalTipCategory;
}
