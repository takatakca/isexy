export const subscriptionTiers = {
  plus: {
    name: "CubaDate Plus",
    price_id: "price_1ShkiHDTp0s6enQIJAQPgle3",
    product_id: "prod_Tf4swUnx8LI3BR",
    plans: [
      { duration: "week", label: "1 Week", weeklyPrice: 9.99, totalPrice: 9.99, popular: true },
      { duration: "month", label: "1 Month", weeklyPrice: 6.62, totalPrice: 26.49, savings: 34 },
      { duration: "6months", label: "6 Months", weeklyPrice: 3.33, totalPrice: 79.99, bestValue: true, savings: 67 },
    ],
    features: [
      "Unlimited Likes",
      "Unlimited Rewinds",
      "Unlimited Passport™ Mode",
      "Control Your Profile",
      "Control Who Sees You",
      "Control Who You See",
      "Hide Ads",
    ],
  },
  gold: {
    name: "CubaDate Gold",
    price_id: "price_1ShkiJDTp0s6enQIMaWUyu9U",
    product_id: "prod_Tf4sVyy62yF0cy",
    plans: [
      { duration: "week", label: "1 Week", weeklyPrice: 14.99, totalPrice: 14.99, popular: true },
      { duration: "month", label: "1 Month", weeklyPrice: 9.99, totalPrice: 39.99, savings: 33 },
      { duration: "6months", label: "6 Months", weeklyPrice: 5.00, totalPrice: 119.99, bestValue: true, savings: 67 },
    ],
    features: [
      "Unlimited Likes",
      "See Who Likes You",
      "Unlimited Rewinds",
      "1 Free Boost per month",
      "5 Free Super Likes per week",
      "Unlimited Passport™ Mode",
      "Top Picks",
      "Hide Ads",
    ],
  },
  platinum: {
    name: "CubaDate Platinum",
    price_id: "price_1ShkiKDTp0s6enQIgWrUd2px",
    product_id: "prod_Tf4sF4GddOh8RM",
    plans: [
      { duration: "week", label: "1 Week", weeklyPrice: 19.99, totalPrice: 19.99, popular: true },
      { duration: "month", label: "1 Month", weeklyPrice: 12.50, totalPrice: 49.99, savings: 38 },
      { duration: "6months", label: "6 Months", weeklyPrice: 6.67, totalPrice: 159.99, bestValue: true, savings: 67 },
    ],
    features: [
      "Unlimited Likes",
      "See Who Likes You",
      "Priority Likes",
      "Unlimited Rewinds",
      "1 Free Boost per month",
      "Unlimited Super Likes",
      "Message before matching",
      "Top Picks",
      "Hide Ads",
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

export function getTierByProductId(productId: string): SubscriptionTier | null {
  for (const [tier, data] of Object.entries(subscriptionTiers)) {
    if (data.product_id === productId) {
      return tier as SubscriptionTier;
    }
  }
  return null;
}
