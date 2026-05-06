export type Duration = "week" | "month" | "six_months";

export const subscriptionTiers = {
  plus: {
    name: "ISEXY Plus",
    plans: [
      { duration: "week" as Duration, label: "1 Week", weeklyPrice: 9.99, totalPrice: 9.99, popular: true },
      { duration: "month" as Duration, label: "1 Month", weeklyPrice: 6.62, totalPrice: 26.49, savings: 34 },
      { duration: "six_months" as Duration, label: "6 Months", weeklyPrice: 3.33, totalPrice: 79.99, bestValue: true, savings: 67 },
    ],
    features: [
      "Unlimited Likes",
      "Unlimited Rewinds",
      "Passport Mode",
      "Control who you see",
      "Hide ads",
    ],
  },
  gold: {
    name: "ISEXY Gold",
    plans: [
      { duration: "week" as Duration, label: "1 Week", weeklyPrice: 14.99, totalPrice: 14.99, popular: true },
      { duration: "month" as Duration, label: "1 Month", weeklyPrice: 9.99, totalPrice: 39.99, savings: 33 },
      { duration: "six_months" as Duration, label: "6 Months", weeklyPrice: 5.0, totalPrice: 119.99, bestValue: true, savings: 67 },
    ],
    features: [
      "Everything in Plus",
      "See who likes you",
      "Top Picks",
      "5 Super Likes per week",
      "1 Boost per month",
    ],
  },
  platinum: {
    name: "ISEXY Platinum",
    plans: [
      { duration: "week" as Duration, label: "1 Week", weeklyPrice: 23.99, totalPrice: 23.99, popular: true },
      { duration: "month" as Duration, label: "1 Month", weeklyPrice: 14.77, totalPrice: 63.99, savings: 33 },
      { duration: "six_months" as Duration, label: "6 Months", weeklyPrice: 7.38, totalPrice: 191.99, bestValue: true, savings: 67 },
    ],
    features: [
      "Everything in Gold",
      "Priority Likes",
      // TODO: verify fulfillment of "Message before matching" feature
      "Message before matching",
      "More profile visibility",
      "Premium discovery priority",
    ],
  },
} as const;

// Boost packages with pricing from screenshots
export const boostPackages = [
  { id: "1", quantity: 1, pricePerItem: 6.49 },
  { id: "10", quantity: 10, pricePerItem: 3.29, popular: true, savings: 49 },
  { id: "20", quantity: 20, pricePerItem: 2.49, bestValue: true, savings: 61 },
];

// Primetime Boost packages
export const primetimeBoostPackages = [
  { id: "1", quantity: 1, pricePerItem: 9.99 },
  { id: "3", quantity: 3, pricePerItem: 9.33, popular: true, savings: 7 },
  { id: "5", quantity: 5, pricePerItem: 7.79, bestValue: true, savings: 22 },
];

// Super Boost packages (hours-based)
export const superBoostPackages = [
  { id: "3h", hours: 3, price: 49.99 },
  { id: "6h", hours: 6, price: 92.99, popular: true, savings: 7 },
  { id: "12h", hours: 12, price: 169.99, bestValue: true, savings: 15 },
];

// Super Likes packages
export const superLikesPackages = [
  { id: "3", quantity: 3, pricePerItem: 3.99 },
  { id: "15", quantity: 15, pricePerItem: 3.26, popular: true, savings: 18 },
  { id: "30", quantity: 30, pricePerItem: 2.49, bestValue: true, savings: 37 },
];

export type SubscriptionTier = keyof typeof subscriptionTiers;
