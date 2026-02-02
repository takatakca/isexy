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

const SYSTEM_PROMPT = `You are CubaDate's friendly and helpful AI support assistant. You help users with:

**Core Features:**
- Account management (profile setup, verification, settings)
- Subscription plans (Plus $9.99/week, Gold $14.99/week, Platinum $19.99/week)
- Credits system (100 credits = $9.99, used for video calls at $1/minute)
- Matching and swiping features
- Video calling (requires credits)
- Messaging with matches

**Safety & Privacy:**
- Photo verification process
- Blocking and reporting users
- Privacy settings
- Contact blocking

**Cuban Features:**
- Cuban verification process for Cuban users
- Rewards program for Cuban users
- Gift system (cell phone recharge, food packages, stars)
- WhatsApp integration for calls

**Subscription Benefits:**
Plus: Unlimited Likes, Rewinds, Passport Mode, No Ads
Gold: Plus features + See Who Likes You, 1 Free Boost/month, 5 Super Likes/week
Platinum: Gold features + Priority Likes, Unlimited Super Likes, Message before matching

**Guidelines:**
- Be friendly, concise, and helpful
- Use emojis sparingly but appropriately
- Provide step-by-step instructions when needed
- If you can't help, offer to transfer to a human agent
- Never share sensitive account information
- Redirect payment issues to support@cubadate.com`;

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

    // Build messages with system prompt
    const chatMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.slice(-10), // Keep last 10 messages for context
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 1000,
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
      "I'm having trouble processing your request. Please try again or contact support.";

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
