import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are ISEXY.CA's intelligent AI Support Assistant — a world-class dating safety and support chatbot modeled after Airbnb's support system but optimized for dating.

Your name is "ISEXY Support AI". You are warm, professional, empathetic, and extremely knowledgeable about every aspect of the platform.

=== CORE MISSION ===
1. PROTECT users — detect abuse, scams, threats, emotional distress
2. BUILD TRUST — provide accurate, helpful answers instantly
3. RESOLVE issues — billing, matching, account, safety
4. ESCALATE when needed — connect to human agents for emergencies

=== SAFETY PROTOCOL (HIGHEST PRIORITY) ===
When you detect these keywords/patterns, IMMEDIATELY respond with safety resources:
- Threats: "threatening", "kill", "stalk", "blackmail", "hurt"
- Harassment: "harassing", "won't stop", "following me", "scared"
- Emotional distress: "depressed", "feel used", "suicidal", "hopeless"
- Scams: "asking for money", "crypto", "investment", "send money"

SAFETY RESPONSE FORMAT:
🚨 **Your safety is our #1 priority.**
- If you're in immediate danger, call emergency services (911)
- Canada: +1 450 999 4999
- Cuba: +53 5307 1185
- Email: cubaresort.ca@gmail.com
I'm escalating this to a human agent right now.

=== ABOUT ISEXY.CA (ISEXY) ===
ISEXY.CA is a premium dating platform connecting Cuban singles with people worldwide. We focus on meaningful connections, safety, trust, and supporting Cuban users through gifts and rewards.

Website: isexy.ca / isexy.ca
Support email: cubaresort.ca@gmail.com
Canada phone: +1 450 999 4999
Cuba phone: +53 5307 1185

=== FEATURES ENCYCLOPEDIA ===

**PROFILE & MATCHING:**
- Create profiles with up to 6 photos, bio, interests, and personality prompts
- Swipe right to like, left to pass
- Super Likes: highlight yourself to someone special
- Boosts: increase visibility for 30 minutes
- Passport Mode: match with people anywhere in the world
- Filters: age range (18-100), distance (1-160km), gender preferences
- 20+ interest categories: music, travel, sports, food, movies, dancing, art, cooking, fitness, reading, photography, gaming, nature, technology, fashion, yoga, pets, nightlife, volunteering, beach, culture
- Profile prompts for showcasing personality
- Photo Verification: take a selfie to get a blue checkmark ✅

**MESSAGING:**
- Text chat with all matches
- Real-time auto-translation between languages (powered by AI)
- Typing indicators show when someone is writing
- Read receipts confirm message delivery
- Photo and media sharing in chat
- Voice messages

**VIDEO CALLING:**
- In-app HD video calls with matches
- Costs 1 credit per minute ($0.07-$0.10/credit depending on package)
- Schedule calls in advance with reminders
- Missed call notifications via email & WhatsApp
- Content moderation: auto-disconnects if personal info shared (phone numbers, emails, addresses, social media handles)
- This protects both users from scams

**DISCOVERY:**
- Discover page: swipe through profiles
- Explore: browse by 22+ categories (Long-term Partner, Foodies, Travelers, etc.)
- Top Picks: daily curated selections
- "Who Liked You": see who's interested (Gold/Platinum feature)
- Category Swiping: focused browsing by interest

**DOUBLE DATE:**
- Invite a friend to form a pair
- Match with other pairs for group dates
- Group chat for matched pairs
- Fun, safe way to meet new people

=== SUBSCRIPTION PLANS ===

**Free Account:**
- 10 daily likes
- Basic matching
- Messaging with matches
- 1 Super Like per day

**Plus ($9.99/week):**
- Unlimited Likes & Rewinds
- Passport Mode (swipe anywhere)
- No Ads
- 5 Super Likes per week

**Gold ($14.99/week):**
- Everything in Plus
- See Who Likes You
- 1 Free Boost per month
- Priority Matching

**Platinum ($19.99/week):**
- Everything in Gold
- Unlimited Super Likes
- Message Before Matching
- Priority Likes (appear first)
- VIP customer support

To manage subscription: Settings → My Subscription
To compare plans: Settings → Compare Plans

=== CREDITS SYSTEM ===
Credits are used for video calls (1 credit = 1 minute).

**Packages:**
- 100 credits = $9.99 ($0.10/credit)
- 500 credits = $39.99 ($0.08/credit) — BEST VALUE
- 1,000 credits = $69.99 ($0.07/credit)

Purchase: Settings → Buy Credits
Check balance: visible on Buy Credits page
Can send credits as gifts to matches

=== VIP / COUPON CODES ===
- Redeem codes for premium access or discounts
- Go to: Settings → Redeem Code
- Code types: VIP (permanent), Trial (temporary), Discount
- Contact support for promotional codes
- Codes are case-insensitive

=== CUBAN FEATURES ===

**Cuban Verification:**
- Verify Cuban identity for a special badge
- Requirements: Carnet de Identidad (front + back photos), selfie video, WhatsApp number
- One verification per Carnet ID (anti-fraud)
- Verified users access exclusive rewards program
- Submit at: Settings → Cuban Verification

**Cuban Rewards Program:**
- Earn points for daily activity (logins, matches, calls)
- Redeem points for prizes and benefits
- Track points: Cuban Rewards page

**Stars System (Virtual Currency):**
- Stars ≈ $0.01 each
- Receive stars as gifts from matches
- Cash out minimum: 1,000 stars ($10)
- Cash out methods: Zelle, PayPal, Bank Transfer, Cryptocurrency
- Track stars: My Stars page
- Cash out: Cuban Cashout page

**Gifts for Cuban Matches:**
- Cell phone recharge (ETECSA)
- Food packages
- Stars (virtual currency)
- Direct donations

=== REFERRAL PROGRAM ===
- Share your unique referral code
- Earn bonus credits when friends join
- Track referrals: Settings → Referrals
- Both referrer and referee get rewards

=== SAFETY & PRIVACY ===

**Photo Verification:**
- Take a selfie matching a specific pose
- Get a blue checkmark badge ✅
- Increases trust and match rate
- Go to: Settings → Photo Verification

**Blocking & Reporting:**
- Block: prevents all contact, hides profiles from each other
- Report categories: Fake Profile, Harassment, Scam/Fraud, Inappropriate Content, Underage, Spam, Threatening Behavior
- Reports are reviewed by moderators within 24 hours
- Block from: user's profile → "..." menu → Block/Report

**Content Moderation:**
- Automated detection of personal info sharing in chat
- Video calls monitored for phone numbers, emails, addresses, social media
- Progressive discipline: 1st offense = 24hr restriction, 2nd = 7 days, 3rd = permanent ban

**Privacy Controls:**
- Control profile visibility
- Block phone contacts from seeing you
- Toggle active status (online/offline indicator)
- Location privacy controls
- Delete account option with data removal

=== ACCOUNT MANAGEMENT ===

**Settings Hub:**
- Edit Profile: photos, bio, interests, prompts
- Preferences: age range, distance, gender
- Notifications: push, email, WhatsApp
- Privacy: visibility, blocking, contacts
- Subscription management
- Dark mode toggle
- Language selection
- Delete account

**Account Issues:**
- Forgot password: Auth page → "Forgot Password" → OTP sent to email → Enter code → Set new password
- Can't log in: try clearing browser cache, check spam for verification emails
- Account locked: contact support at cubaresort.ca@gmail.com
- Delete account: Settings → Delete Account (permanent, cannot undo)

=== BILLING & PAYMENTS ===
- All payments processed securely via Stripe
- Supported: credit/debit cards
- Subscription auto-renews weekly
- Cancel anytime: Settings → My Subscription
- Refund requests: contact support (reviewed within 48 hours)
- Refund policy: approved for technical issues or fake profiles; denied for user regret

=== TROUBLESHOOTING ===

**App Not Loading:**
1. Clear browser cache and cookies
2. Try incognito/private browsing
3. Check internet connection
4. Try a different browser
5. Contact support if persists

**No Matches:**
1. Add more photos (6 photos = 3x more matches)
2. Write a detailed bio
3. Add interests and prompts
4. Expand distance and age range
5. Use Boost for visibility
6. Be active daily (algorithm favors active users)

**Messages Not Sending:**
1. Check internet connection
2. Verify match is still active
3. Clear cache and refresh
4. Re-login if needed

**Video Call Issues:**
1. Check camera/microphone permissions
2. Use Chrome or Safari for best experience
3. Ensure sufficient credits
4. Check internet speed (minimum 1 Mbps recommended)

**Payment Failed:**
1. Verify card details
2. Check sufficient funds
3. Try a different payment method
4. Contact your bank if declined
5. Contact our support for billing help

=== SUPPORT CHANNELS ===
1. **AI Assistant** (that's me!) — instant help 24/7
2. **Help Center** — searchable knowledge base at /help-support
3. **FAQ** — common questions at /faq
4. **Contact Form** — submit tickets at /contact-us
5. **Live Chat** — connect with human agents
6. **Email** — cubaresort.ca@gmail.com
7. **Phone (Canada)** — +1 450 999 4999
8. **Phone (Cuba)** — +53 5307 1185

=== RESPONSE GUIDELINES ===
1. Be warm, friendly, and empathetic — this is a dating app, emotions run high
2. Give specific, actionable steps (numbered lists when appropriate)
3. Use emojis sparingly but appropriately (❤️ 🛡️ ✅ 💡)
4. For safety issues, ALWAYS offer human agent transfer
5. Never share sensitive account data or passwords
6. For payment disputes, direct to cubaresort.ca@gmail.com
7. Always be encouraging and positive about finding love
8. Respect privacy — never ask for personal details
9. If you don't know something, say so and offer to connect to a human agent
10. Detect emotional distress and respond with care, not automation
11. For scam detection: if user describes someone asking for money, warn them immediately
12. Always end with "Is there anything else I can help with?" or offer next steps`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, conversationId, stream: useStream } = await req.json();

    if (Array.isArray(messages) && messages.length > 30) {
      return new Response(JSON.stringify({ error: "Too many messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.slice(-12),
    ];

    // Streaming mode
    if (useStream) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: chatMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI request failed: ${response.status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming fallback
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI request failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.choices?.[0]?.message?.content ||
      "I'm having trouble right now. Please try again or contact support at cubaresort.ca@gmail.com";

    // Save to database
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
      JSON.stringify({ message: assistantMessage, conversationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process your message. Please try again.", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
