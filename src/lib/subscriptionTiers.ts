export const subscriptionTiers = {
  plus: {
    name: "CubaDate Plus",
    price_id: "price_1ShkiHDTp0s6enQIJAQPgle3",
    product_id: "prod_Tf4swUnx8LI3BR",
    price: 14.99,
    weeklyPrice: 3.75,
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
    price: 29.99,
    weeklyPrice: 7.50,
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
    price: 39.99,
    weeklyPrice: 10.00,
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

export type SubscriptionTier = keyof typeof subscriptionTiers;

export function getTierByProductId(productId: string): SubscriptionTier | null {
  for (const [tier, data] of Object.entries(subscriptionTiers)) {
    if (data.product_id === productId) {
      return tier as SubscriptionTier;
    }
  }
  return null;
}
