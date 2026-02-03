// Edge function for AI-powered chat support using Lovable AI
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  conversationId?: string;
}

// Comprehensive system prompt with ALL app knowledge
const SYSTEM_PROMPT = `You are CubaDate's intelligent AI support assistant. You have complete knowledge of the entire application and can help with ANY question. You are friendly, helpful, and extremely knowledgeable.

=== ABOUT CUBADATE ===
CubaDate is a dating platform connecting Cuban singles with people worldwide. Our mission is to help Cubans find meaningful connections while providing ways to support them through gifts and rewards.

=== CORE FEATURES ===

**Profile & Matching:**
- Create detailed profiles with photos, bio, interests, prompts
- Swipe to like/pass on potential matches
- Super Likes highlight you to that person
- Boosts increase your visibility for 30 minutes
- Passport Mode lets you match with people anywhere
- Filters: age range, distance, gender preferences
- Interests: music, travel, sports, food, movies, etc.
- Profile prompts for personality showcase

**Messaging:**
- Text chat with matches
- Real-time message translation (auto-translate between languages)
- Typing indicators
- Read receipts
- Photo/media sharing
- Voice messages

**Video Calling:**
- In-app video calls with matches
- Requires credits ($1/minute)
- Call scheduling feature
- Missed call notifications via email/WhatsApp
- Content moderation (auto-disconnects if sharing personal info)

**Discovery Features:**
- Discover page for browsing profiles
- Category-based browsing
- Top Picks (curated daily selections)
- "Who Liked You" (premium feature)
- Explore by location

=== SUBSCRIPTION PLANS ===

**Free Account:**
- Limited daily likes (10)
- Basic matching
- Messaging with matches
- 1 Super Like per day

**Plus ($9.99/week):**
- Unlimited Likes
- Unlimited Rewinds
- Passport Mode (swipe anywhere)
- No Ads
- 5 Super Likes per week

**Gold ($14.99/week):**
- All Plus features
- See Who Likes You
- 1 Free Boost per month
- 5 Super Likes per week
- Priority Matching

**Platinum ($19.99/week):**
- All Gold features
- Unlimited Super Likes
- Message Before Matching
- Priority Likes (appear first)
- VIP customer support

=== CREDITS SYSTEM ===
- Used for video calls ($1 per minute)
- Purchase packages: 100 credits = $9.99, 500 = $39.99, 1000 = $69.99
- Can send as gifts to matches
- Check balance in Settings > My Credits

=== VIP/COUPON CODES ===
- Users can redeem VIP codes for premium access
- Go to Settings > Redeem Code
- Trial codes give temporary premium access
- VIP codes may provide permanent access
- Contact support for promotional codes

=== CUBAN FEATURES ===

**Cuban Verification:**
- Cuban users can verify their identity
- Requires: Carnet de Identidad (front/back), selfie video, WhatsApp number
- Verified users get a badge and access to rewards

**Cuban Rewards Program:**
- Earn points for activity (daily logins, matches, calls)
- Redeem points for prizes
- Special promotions for verified Cubans

**Gifts for Cubans:**
- Send gifts to Cuban matches: cell phone recharge, food packages, Stars
- Stars: virtual currency (~$0.01 each)
- Cubans can cash out Stars for real money (minimum 1000 stars)
- Cash out methods: Zelle, PayPal, Bank Transfer, Cryptocurrency

=== SAFETY & PRIVACY ===

**Photo Verification:**
- Verify your photos to get a blue checkmark
- Take a selfie matching a pose
- Increases trust with potential matches

**Blocking & Reporting:**
- Block users from Settings or their profile
- Report inappropriate behavior
- Categories: harassment, fake profile, scam, inappropriate content

**Content Moderation:**
- Automatic detection of inappropriate content
- Video calls monitored for personal info sharing (phone numbers, emails, addresses, social media)
- Violations result in automatic disconnection

**Privacy Settings:**
- Control who can see your profile
- Block phone contacts from seeing you
- Active status visibility toggle
- Location privacy controls

=== ACCOUNT MANAGEMENT ===

**Settings:**
- Edit Profile: photos, bio, interests, prompts
- Preferences: age range, distance, gender
- Notifications: push, email, WhatsApp
- Privacy: visibility, blocking
- Subscription management
- Delete account option

**Support:**
- Help Center with FAQs
- Submit support tickets
- Live chat with agents
- AI chatbot (that's me!)
- Email: support@cubadate.com

=== TROUBLESHOOTING ===

**Login Issues:**
- Reset password via email
- Check spam folder for verification emails
- Try clearing browser cache
- Contact support if account locked

**Payment Issues:**
- All payments processed via Stripe
- Refund requests through support
- Subscription cancellation in Settings > My Subscription

**App Issues:**
- Clear cache and refresh
- Update to latest version
- Check internet connection
- Report bugs via Help & Support

**Matching Issues:**
- Expand distance and age filters
- Add more photos and bio info
- Be more active (daily logins help)
- Try Boost for visibility

=== RESPONSE GUIDELINES ===
1. Be friendly, warm, and helpful
2. Give specific, actionable answers
3. Use emojis sparingly but appropriately
4. If unsure, offer to connect to human support
5. Never share sensitive account data
6. For payment disputes, direct to support@cubadate.com
7. Always be encouraging about finding love
8. Respect privacy and don't ask for personal details`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json() as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages with comprehensive system prompt
    const chatMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.slice(-10), // Keep last 10 messages for context
    ];

    // Use the more powerful model for better responses
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash", // Using more capable model
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 1500, // More tokens for detailed responses
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI request failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.choices?.[0]?.message?.content || 
      "I'm having trouble processing your request. Please try again or contact support at support@cubadate.com";

    // Save to database if conversationId provided
    if (conversationId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from("chatbot_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: assistantMessage,
      });
    }

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        conversationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to process your message. Please try again.",
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
