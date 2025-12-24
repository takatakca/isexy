export const subscriptionTiers = {
  plus: {
    name: "CubaDate Plus",
    price_id: "price_1ShkiHDTp0s6enQIJAQPgle3",
    product_id: "prod_Tf4swUnx8LI3BR",
    price: 14.99,
    features: [
      "Unlimited Likes",
      "5 Rewinds per day",
      "1 Boost per month",
      "5 Super Likes per week",
    ],
  },
  gold: {
    name: "CubaDate Gold",
    price_id: "price_1ShkiJDTp0s6enQIMaWUyu9U",
    product_id: "prod_Tf4sVyy62yF0cy",
    price: 29.99,
    features: [
      "Unlimited Likes",
      "See who likes you",
      "Unlimited Rewinds",
      "5 Boosts per month",
      "5 Super Likes per week",
    ],
  },
  platinum: {
    name: "CubaDate Platinum",
    price_id: "price_1ShkiKDTp0s6enQIgWrUd2px",
    product_id: "prod_Tf4sF4GddOh8RM",
    price: 39.99,
    features: [
      "Unlimited Likes",
      "See who likes you",
      "Unlimited Rewinds",
      "Unlimited Boosts",
      "Unlimited Super Likes",
      "Priority Likes",
      "Message before matching",
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
