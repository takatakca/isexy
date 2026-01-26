// Edge function to seed sample Cuban profiles for testing
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cuban cities with populations
const cubanCities = [
  { name: "La Habana", lat: 23.1136, lng: -82.3666 },
  { name: "Santiago de Cuba", lat: 20.0247, lng: -75.8219 },
  { name: "Camagüey", lat: 21.3808, lng: -77.9169 },
  { name: "Holguín", lat: 20.7876, lng: -76.2631 },
  { name: "Santa Clara", lat: 22.4068, lng: -79.9536 },
  { name: "Guantánamo", lat: 20.1452, lng: -75.2094 },
  { name: "Bayamo", lat: 20.3795, lng: -76.6433 },
  { name: "Las Tunas", lat: 20.9601, lng: -76.9511 },
  { name: "Cienfuegos", lat: 22.1444, lng: -80.4364 },
  { name: "Pinar del Río", lat: 22.4175, lng: -83.6978 },
  { name: "Matanzas", lat: 23.0511, lng: -81.5775 },
  { name: "Ciego de Ávila", lat: 21.8403, lng: -78.7620 },
  { name: "Sancti Spíritus", lat: 21.9304, lng: -79.4429 },
  { name: "Manzanillo", lat: 20.3428, lng: -77.1167 },
  { name: "Nuevitas", lat: 21.5455, lng: -77.2647 },
  { name: "Trinidad", lat: 21.8022, lng: -79.9844 },
  { name: "Cárdenas", lat: 23.0403, lng: -81.2053 },
  { name: "Artemisa", lat: 22.8133, lng: -82.7617 },
  { name: "Viñales", lat: 22.6167, lng: -83.7142 },
  { name: "Varadero", lat: 23.1544, lng: -81.2483 },
];

// Cuban first names
const maleNames = [
  "José", "Luis", "Carlos", "Miguel", "Jorge", "Roberto", "Antonio", "Juan", "Manuel", "Pedro",
  "Rafael", "Fernando", "Ricardo", "Alberto", "Alejandro", "Eduardo", "Francisco", "Andrés", "Daniel", "Diego",
  "Ramón", "Enrique", "Mario", "Pablo", "Raúl", "Armando", "Ernesto", "Héctor", "Orlando", "Omar",
  "Sergio", "Víctor", "Ángel", "César", "Julio", "Tomás", "Adrián", "Iván", "Yosvany", "Lázaro",
  "Nelson", "Reinaldo", "Rubén", "Dámaso", "Félix", "Gilberto", "Osmany", "Yoan", "Yasser", "Yordanis"
];

const femaleNames = [
  "María", "Ana", "Laura", "Carmen", "Rosa", "Marta", "Isabel", "Lucía", "Elena", "Diana",
  "Patricia", "Yamilet", "Dayana", "Yanela", "Yanet", "Yolanda", "Yuneisy", "Yudith", "Yuleidis", "Yanelis",
  "Lisandra", "Lidia", "Lourdes", "Maikel", "Madelín", "Maribel", "Mayra", "Mercedes", "Miriam", "Nancy",
  "Norma", "Olga", "Ondina", "Odalys", "Paula", "Pilar", "Raquel", "Sandra", "Sonia", "Susana",
  "Teresa", "Tamara", "Tania", "Yaimara", "Yailén", "Yamila", "Yanisleidy", "Yenisey", "Yosvely", "Zulema"
];

// Interests
const interests = [
  "Salsa", "Reggaeton", "Son Cubano", "Baseball", "Boxing", "Beach", "Dancing", "Music",
  "Cooking", "Travel", "Photography", "Movies", "Reading", "Fitness", "Swimming", "Hiking",
  "Art", "History", "Culture", "Nature", "Dogs", "Cats", "Coffee", "Food", "Fashion",
  "Sports", "Yoga", "Meditation", "Languages", "Learning"
];

// Bios
const maleBios = [
  "Cubano de corazón. Me encanta la música y bailar salsa. Busco alguien especial para compartir la vida.",
  "Trabajo como músico. La música es mi pasión. Busco una mujer sincera y cariñosa.",
  "Soy un hombre sencillo que valora la familia y la honestidad. Me gusta el béisbol y la buena conversación.",
  "Artista cubano buscando su musa. Creo en el amor verdadero y las conexiones genuinas.",
  "Me fascina la cultura canadiense. Quiero conocer a alguien que me enseñe sobre su país mientras comparto mi hermosa Cuba.",
  "Ingeniero de profesión, romántico de corazón. Busco una relación seria y duradera.",
  "La vida es mejor acompañado. Soy un hombre fiel, trabajador y con muchos sueños por cumplir.",
  "Amante de la naturaleza y las playas cubanas. Busco a alguien que disfrute de las cosas simples de la vida.",
];

const femaleBios = [
  "Cubana alegre y cariñosa. Me encanta cocinar y bailar. Busco a alguien especial con quien compartir mi vida.",
  "Soy una mujer sincera y romántica. Creo en el amor verdadero y las relaciones duraderas.",
  "Trabajo como enfermera. Me apasiona ayudar a los demás. Busco un hombre serio y responsable.",
  "Me encanta la música cubana y pasar tiempo con mi familia. Busco a alguien que valore estas cosas.",
  "Soy creativa y soñadora. Me gustaría conocer nuevas culturas y encontrar el amor.",
  "Mujer cubana tradicional pero con mente abierta. Valoro la honestidad y la comunicación.",
  "La felicidad está en las pequeñas cosas. Busco a alguien para crear memorias juntos.",
  "Apasionada de la vida y el arte. Creo que el amor no tiene fronteras.",
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomAge(): number {
  return Math.floor(Math.random() * 20) + 22; // 22-41
}

function getRandomBirthDate(age: number): string {
  const today = new Date();
  const year = today.getFullYear() - age;
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getRandomInterests(): string[] {
  const count = Math.floor(Math.random() * 5) + 3;
  const shuffled = [...interests].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const profiles = [];
    // Diverse Latino/Cuban photo URLs from Unsplash
    const malePhotoUrls = [
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400", // Latino man
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400", // Hispanic man
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400", // Cuban style
      "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400", // Dark hair man
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400", // Casual man
      "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400", // Beach man
      "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=400", // Cuban vibe
      "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400", // Latino style
      "https://images.unsplash.com/photo-1548372290-8d01b6c8e78c?w=400", // Beach guy
      "https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=400", // Latin man
    ];
    
    const femalePhotoUrls = [
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400", // Latina woman
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", // Hispanic beauty
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400", // Cuban style
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400", // Dark hair woman
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400", // Beach woman
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400", // Latina beauty
      "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400", // Cuban woman
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400", // Caribbean look
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400", // Tropical vibe
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400", // Natural beauty
    ];

    // Generate 1000 profiles - NO user_id since these are demo profiles
    for (let i = 0; i < 1000; i++) {
      const isMale = Math.random() > 0.5;
      const city = getRandomElement(cubanCities);
      const age = getRandomAge();
      
      profiles.push({
        // Use a placeholder user_id that doesn't reference auth.users
        // This creates orphaned profiles for demo purposes only
        first_name: isMale ? getRandomElement(maleNames) : getRandomElement(femaleNames),
        birth_date: getRandomBirthDate(age),
        gender: isMale ? "Male" : "Female",
        sexual_orientation: "Straight",
        interested_in: isMale ? ["Women"] : ["Men"],
        looking_for: getRandomElement(["Long-term partner", "Serious dating", "Marriage", "Relationship"]),
        bio: isMale ? getRandomElement(maleBios) : getRandomElement(femaleBios),
        city: city.name,
        country: "Cuba",
        latitude: city.lat + (Math.random() - 0.5) * 0.1,
        longitude: city.lng + (Math.random() - 0.5) * 0.1,
        is_cuban: true,
        is_active: true,
        is_verified: Math.random() > 0.3,
        distance_preference: 100,
        age_min: 18,
        age_max: 55,
        interests: getRandomInterests(),
      });
    }

    // First, we need to create fake auth users using service role
    // Since profiles.user_id has a FK constraint, we need to work around this
    
    // Option: Insert profiles with generated UUIDs for user_id 
    // Since we're using service role, we can bypass RLS
    // But the FK constraint still applies - we need to create auth users first

    // Create auth users and profiles together
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const email = `demo${i}@cubadate.test`;
      const password = crypto.randomUUID();

      try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError || !authData.user) {
          errors.push(`User ${i}: ${authError?.message || 'Unknown error'}`);
          continue;
        }

        // Insert profile with the real user_id
        const { error: profileError } = await supabase.from("profiles").insert({
          ...profile,
          user_id: authData.user.id,
        });

        if (profileError) {
          errors.push(`Profile ${i}: ${profileError.message}`);
        } else {
          successCount++;
        }
      } catch (err: any) {
        errors.push(`Batch ${i}: ${err.message}`);
      }

      // Add small delay every 50 profiles to avoid rate limits
      if (i > 0 && i % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Add photos for some profiles
    const { data: insertedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_cuban", true)
      .limit(500);

    if (insertedProfiles) {
      const photos = insertedProfiles.map((profile: any, index: number) => {
        // Determine gender from profile to select appropriate photo
        const isMale = index % 2 === 0; // Alternate for variety
        const photoPool = isMale ? malePhotoUrls : femalePhotoUrls;
        return {
          profile_id: profile.id,
          photo_url: photoPool[index % photoPool.length],
          position: 0,
        };
      });

      for (let i = 0; i < photos.length; i += 100) {
        const batch = photos.slice(i, i + 100);
        await supabase.from("profile_photos").insert(batch);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Created ${successCount} sample profiles`,
        errors: errors.slice(0, 10) // Return first 10 errors for debugging
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
