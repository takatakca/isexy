import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, Search, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const allInterests = [
  // Sports & Fitness
  "Tennis", "Skateboarding", "Gymnastics", "Hockey", "Basketball", "Running", "Gym",
  "Cricket", "Weightlifting", "Wrestling", "Marathon", "Martial Arts", "Volleyball",
  "Padel", "Equestrian", "Soccer", "Baseball", "Archery", "Crossfit", "Climbing",
  "Cycling", "Swimming", "Table Tennis", "Working out", "Home Workout", "Yoga",
  "Ice Hockey", "Sports Shooting", "Athletics", "Sports", "Walking", "Beach sports",
  "Fitness classes", "Skating", "Rugby",
  
  // Outdoor & Adventure
  "Paddle Boarding", "Surfing", "Beach Bars", "Paragliding", "Sailing", "Hiking",
  "Mountains", "Backpacking", "Rock Climbing", "Fishing", "Camping", "Outdoors",
  "Picnicking", "Rowing", "Diving", "Jetskiing", "Walking tours", "Nature",
  "Hot Springs", "Walking My Dog", "Skiing", "Canoeing", "Snowboarding", "Road Trips",
  "Couchsurfing", "Free Diving", "Travel",
  
  // Music
  "Latin music", "Alternative music", "Techno", "Jazz", "House music", "EDM", "R&B",
  "Indie music", "Opera", "Heavy Metal", "Funk music", "Reggaeton", "Country Music",
  "Hip Hop", "J-Pop", "Electronic Music", "Grime", "90s Britpop", "Trap Music",
  "Music", "Gospel music", "Music bands", "Rock music", "Soul music", "Pop music",
  "K-Pop", "Punk rock", "Rap music", "Folk music", "Live Music", "Concerts",
  
  // Entertainment & Nightlife
  "Musical theater", "Cafe hopping", "Aquarium", "Clubbing", "Exhibition", "Shopping",
  "Cars", "Pub Quiz", "Festivals", "Happy hour", "Stand up Comedy", "Karaoke",
  "House Parties", "Theater", "Shisha", "Rollerskating", "Bar Hopping", "Bowling",
  "Motorcycles", "Parties", "Nightlife", "Art galleries", "Film Festival", "Pubs",
  "Town Festivities", "Raves", "Drive-in Cinema",
  
  // Food & Drinks
  "Manga", "Marvel", "Disney", "Foodie", "Food tours", "Mocktails", "Sweet treats",
  "Brunch", "Açaí", "Street Food", "Plant-based", "Boba tea", "Cocktails",
  "Ice Cream", "Coffee", "Sushi", "Pho", "Wine", "Ramen", "Korean Food", "BBQ",
  "Craft Beer", "Tea", "Cooking", "Baking",
  
  // Gaming
  "PlayStation", "E-Sports", "Fortnite", "Xbox", "League of Legends", "Nintendo",
  "Among Us", "Atari", "Roblox", "Online Games", "Board Games", "Trivia",
  "Dungeons & Dragons", "Escape Rooms",
  
  // Social Media & Tech
  "Instagram", "X", "SoundCloud", "Pinterest", "Spotify", "Social Media", "Vlogging",
  "YouTube", "Virtual Reality", "Memes", "Metaverse", "Podcasts", "TikTok", "Twitch",
  "Netflix", "Binge-Watching TV shows",
  
  // Creative & Hobbies
  "Freelancing", "Photography", "Choir", "Cosplay", "Content Creation",
  "Vintage fashion", "Investing", "Singing", "Poetry", "Sneakers", "Language Exchange",
  "Writing", "Literature", "NFTs", "Tattoos", "Painting", "Upcycling",
  "Entrepreneurship", "Acapella", "Musical Instrument", "Musical Writing", "Dancing",
  "Exchange Program", "Art", "Real Estate", "Drawing", "Blogging", "Fashion", "DIY",
  "Comic-con", "Harry Potter", "90s Kid", "NBA", "MLB", "Gardening", "Thrifting",
  "Museums", "Reading",
  
  // Movies & TV
  "K-drama shows", "Horror Movies", "Bollywood", "Movies", "Sci-Fi", "Anime",
  "Comedy", "Action movies", "Animated movies",
  
  // Social Causes
  "Mental Health Awareness", "Voter Rights", "Climate Change", "LGBTQIA+ Rights",
  "Feminism", "Black Lives Matter", "Inclusivity", "Human Rights", "Social Development",
  "Volunteering", "Environmentalism", "World Peace", "Pride", "Youth Empowerment",
  "Equality", "Politics", "Activism", "Disability Rights", "Self Love", "Trying New Things",
  "Tarot", "Spa",
];

export default function Interests() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    profile?.interests || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const maxInterests = 10;

  const filteredInterests = useMemo(() => {
    if (!searchQuery.trim()) return allInterests;
    const query = searchQuery.toLowerCase();
    return allInterests.filter((interest) =>
      interest.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests((prev) => prev.filter((i) => i !== interest));
    } else if (selectedInterests.length < maxInterests) {
      setSelectedInterests((prev) => [...prev, interest]);
    } else {
      toast.error(`You can only select up to ${maxInterests} interests`);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ interests: selectedInterests })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to save interests");
      console.error(error);
    } else {
      toast.success("Interests saved!");
      await refreshProfile();
      navigate(-1);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <X className="w-6 h-6 text-foreground" />
          </button>
          <span className="text-muted-foreground font-semibold">
            {selectedInterests.length} of {maxInterests}
          </span>
        </div>
        
        <h1 className="text-3xl font-bold text-foreground mb-2">Interests</h1>
        <p className="text-muted-foreground mb-4">
          Interests makes it easier to find who shares your interests. Add 0-10 to your profile to make better connections.
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-muted rounded-xl outline-none focus:ring-2 focus:ring-primary text-foreground"
          />
        </div>
      </header>

      {/* Selected Interests (if any) */}
      {selectedInterests.length > 0 && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold text-foreground mb-2">Selected</p>
          <div className="flex flex-wrap gap-2">
            {selectedInterests.map((interest) => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium"
              >
                {interest}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interests Grid */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {filteredInterests.map((interest) => {
            const isSelected = selectedInterests.includes(interest);
            return (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary/50"
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>

        {filteredInterests.length === 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No interests found matching "{searchQuery}"</p>
          </div>
        )}
      </main>

      {/* Save Button */}
      <div className="sticky bottom-0 p-4 bg-background border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-gradient-to-r from-primary to-rose-500 text-primary-foreground rounded-full font-bold text-lg disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Interests"}
        </button>
      </div>
    </div>
  );
}
