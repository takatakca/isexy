// Edge function for live message translation using Lovable AI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, targetLanguage, sourceLanguage } = await req.json() as TranslationRequest;

    if (!text || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: "Missing text or targetLanguage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Lovable AI Gateway for translation
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "Translation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const languageNames: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      pt: "Portuguese",
      de: "German",
      it: "Italian",
      ru: "Russian",
      zh: "Chinese",
      ja: "Japanese",
      ko: "Korean",
      ar: "Arabic",
      hi: "Hindi",
      nl: "Dutch",
      pl: "Polish",
      tr: "Turkish",
      vi: "Vietnamese",
      th: "Thai",
      sv: "Swedish",
      da: "Danish",
      fi: "Finnish",
      no: "Norwegian",
      el: "Greek",
      he: "Hebrew",
      cs: "Czech",
      ro: "Romanian",
      hu: "Hungarian",
      uk: "Ukrainian",
      id: "Indonesian",
      ms: "Malay",
      ca: "Catalan",
    };

    const targetLangName = languageNames[targetLanguage] || targetLanguage;
    const sourceLangName = sourceLanguage ? languageNames[sourceLanguage] || sourceLanguage : "auto-detect";

    const prompt = `Translate the following message to ${targetLangName}. Only return the translated text, nothing else. Keep the tone and style of the original message. If the text is already in ${targetLangName}, return it as-is.

Message to translate: "${text}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error("Translation failed");
    }

    const aiResponse = await response.json();
    const translatedText = aiResponse.choices?.[0]?.message?.content?.trim() || text;

    // Remove quotes if the AI wrapped the response in them
    const cleanedTranslation = translatedText.replace(/^["']|["']$/g, "");

    return new Response(
      JSON.stringify({
        translatedText: cleanedTranslation,
        sourceLanguage: sourceLangName,
        targetLanguage: targetLangName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Translation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
