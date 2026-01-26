export const PROFILE_PROMPTS = [
  // Conversation Starters
  {
    id: "two_truths_lie",
    category: "Conversation Starters",
    title: "Two truths and a lie",
    emoji: "🤥",
    placeholder: "Write two truths and one lie about yourself...",
    maxLength: 300,
  },
  {
    id: "travel_story",
    category: "Conversation Starters",
    title: "Best travel story",
    emoji: "✈️",
    placeholder: "Share your most memorable travel experience...",
    maxLength: 300,
  },
  {
    id: "perfect_weekend",
    category: "Conversation Starters",
    title: "A perfect weekend for me looks like...",
    emoji: "🌅",
    placeholder: "Describe your ideal weekend...",
    maxLength: 300,
  },
  {
    id: "unpopular_opinion",
    category: "Conversation Starters",
    title: "My most unpopular opinion is",
    emoji: "🔥",
    placeholder: "Share something controversial you believe...",
    maxLength: 300,
  },
  {
    id: "guilty_pleasure",
    category: "Conversation Starters",
    title: "My guilty pleasure is",
    emoji: "🙈",
    placeholder: "What's your secret indulgence?",
    maxLength: 300,
  },
  
  // About Me
  {
    id: "never_shut_up",
    category: "About Me",
    title: "I'll never shut up about",
    emoji: "💬",
    placeholder: "What topic could you talk about for hours?",
    maxLength: 300,
  },
  {
    id: "geek_about",
    category: "About Me",
    title: "I geek out on",
    emoji: "🤓",
    placeholder: "What are you nerdy about?",
    maxLength: 300,
  },
  {
    id: "unusual_skill",
    category: "About Me",
    title: "My most unusual skill is",
    emoji: "🎯",
    placeholder: "What's your hidden talent?",
    maxLength: 300,
  },
  {
    id: "simple_pleasures",
    category: "About Me",
    title: "My simple pleasures",
    emoji: "☕",
    placeholder: "What little things make you happy?",
    maxLength: 300,
  },
  {
    id: "fun_fact",
    category: "About Me",
    title: "A fun fact I'm obsessed with",
    emoji: "💡",
    placeholder: "Share an interesting fact you love...",
    maxLength: 300,
  },

  // Looking For
  {
    id: "someone_who",
    category: "Looking For",
    title: "I'm looking for someone who",
    emoji: "👀",
    placeholder: "Describe your ideal match...",
    maxLength: 300,
  },
  {
    id: "green_flags",
    category: "Looking For",
    title: "Green flags I'm looking for",
    emoji: "🟢",
    placeholder: "What qualities attract you?",
    maxLength: 300,
  },
  {
    id: "together_we",
    category: "Looking For",
    title: "Together, we could",
    emoji: "🤝",
    placeholder: "What would you do with your match?",
    maxLength: 300,
  },
  {
    id: "date_idea",
    category: "Looking For",
    title: "My ideal first date",
    emoji: "❤️",
    placeholder: "Describe your perfect first date...",
    maxLength: 300,
  },

  // Humor
  {
    id: "worst_pickup",
    category: "Humor",
    title: "Worst pickup line that worked on me",
    emoji: "😂",
    placeholder: "Share a funny or cringy pickup line...",
    maxLength: 300,
  },
  {
    id: "embarrassing_moment",
    category: "Humor",
    title: "My most embarrassing moment",
    emoji: "🫣",
    placeholder: "What moment makes you cringe?",
    maxLength: 300,
  },
  {
    id: "irrational_fear",
    category: "Humor",
    title: "My most irrational fear",
    emoji: "😱",
    placeholder: "What scares you for no good reason?",
    maxLength: 300,
  },

  // Lifestyle
  {
    id: "sunday_morning",
    category: "Lifestyle",
    title: "On a typical Sunday morning you'll find me",
    emoji: "☀️",
    placeholder: "Describe your Sunday routine...",
    maxLength: 300,
  },
  {
    id: "comfort_food",
    category: "Lifestyle",
    title: "My go-to comfort food is",
    emoji: "🍕",
    placeholder: "What's your comfort meal?",
    maxLength: 300,
  },
  {
    id: "binge_watch",
    category: "Lifestyle",
    title: "Currently binge-watching",
    emoji: "📺",
    placeholder: "What show are you hooked on?",
    maxLength: 300,
  },
] as const;

export type ProfilePrompt = typeof PROFILE_PROMPTS[number];
export type PromptId = ProfilePrompt["id"];

export interface PromptAnswer {
  promptId: PromptId;
  answer: string;
}

export const getPromptById = (id: PromptId): ProfilePrompt | undefined => {
  return PROFILE_PROMPTS.find(p => p.id === id);
};

export const getPromptsByCategory = () => {
  const categories: Record<string, ProfilePrompt[]> = {};
  PROFILE_PROMPTS.forEach(prompt => {
    if (!categories[prompt.category]) {
      categories[prompt.category] = [];
    }
    categories[prompt.category].push(prompt);
  });
  return categories;
};
