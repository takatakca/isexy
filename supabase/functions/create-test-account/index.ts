import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const email = `teststripe${Date.now()}@example.com`;
    const password = `TestPass123!`;

    // Create confirmed auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return jsonResponse({ error: authError?.message || "Failed to create user" }, 500);
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: authData.user.id,
      first_name: "Test",
      birth_date: "1995-01-01",
      gender: "man",
      interested_in: ["woman"],
      country: "Canada",
      is_cuban: false,
      privacy_accepted: true,
    });

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }

    return jsonResponse({ email, password, user_id: authData.user.id });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
});
