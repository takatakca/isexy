import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Search, Check, Globe, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  popular?: boolean;
}

const cubanCities: Location[] = [
  { id: "havana", name: "La Habana", country: "Cuba", latitude: 23.1136, longitude: -82.3666, popular: true },
  { id: "varadero", name: "Varadero", country: "Cuba", latitude: 23.1561, longitude: -81.2452, popular: true },
  { id: "trinidad", name: "Trinidad", country: "Cuba", latitude: 21.8010, longitude: -79.9844, popular: true },
  { id: "santiago", name: "Santiago de Cuba", country: "Cuba", latitude: 20.0169, longitude: -75.8301, popular: true },
  { id: "camaguey", name: "Camagüey", country: "Cuba", latitude: 21.3808, longitude: -77.9169 },
  { id: "holguin", name: "Holguín", country: "Cuba", latitude: 20.7870, longitude: -76.2792 },
  { id: "cienfuegos", name: "Cienfuegos", country: "Cuba", latitude: 22.1456, longitude: -80.4364 },
  { id: "santaclara", name: "Santa Clara", country: "Cuba", latitude: 22.4069, longitude: -79.9554 },
  { id: "matanzas", name: "Matanzas", country: "Cuba", latitude: 23.0511, longitude: -81.5775 },
  { id: "pinardelrio", name: "Pinar del Río", country: "Cuba", latitude: 22.4175, longitude: -83.6989 },
];

const internationalCities: Location[] = [
  { id: "miami", name: "Miami", country: "USA", latitude: 25.7617, longitude: -80.1918, popular: true },
  { id: "toronto", name: "Toronto", country: "Canada", latitude: 43.6532, longitude: -79.3832, popular: true },
  { id: "montreal", name: "Montreal", country: "Canada", latitude: 45.5017, longitude: -73.5673 },
  { id: "mexico", name: "Mexico City", country: "Mexico", latitude: 19.4326, longitude: -99.1332, popular: true },
  { id: "madrid", name: "Madrid", country: "Spain", latitude: 40.4168, longitude: -3.7038 },
  { id: "cancun", name: "Cancún", country: "Mexico", latitude: 21.1619, longitude: -86.8515 },
  { id: "newyork", name: "New York", country: "USA", latitude: 40.7128, longitude: -74.0060 },
  { id: "losangeles", name: "Los Angeles", country: "USA", latitude: 34.0522, longitude: -118.2437 },
];

export default function PassportMode() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);

  const isPremiumUser = profile?.subscription_tier === 'plus' || 
                         profile?.subscription_tier === 'gold' || 
                         profile?.subscription_tier === 'platinum';

  const allCities = [...cubanCities, ...internationalCities];
  
  const filteredCities = searchQuery 
    ? allCities.filter(city => 
        city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.country.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const handleSelectLocation = async (location: Location) => {
    if (!isPremiumUser) {
      navigate("/premium");
      return;
    }

    setLoading(true);
    setSelectedLocation(location);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          latitude: location.latitude,
          longitude: location.longitude,
          city: location.name,
        })
        .eq("id", profile?.id);

      if (error) throw error;

      toast.success(`Location changed to ${location.name}, ${location.country}`);
      navigate("/discover");
    } catch (error) {
      console.error("Error updating location:", error);
      toast.error("Failed to update location");
    } finally {
      setLoading(false);
    }
  };

  const handleResetLocation = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      // Use browser geolocation
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { error } = await supabase
            .from("profiles")
            .update({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              city: null, // Will be auto-detected
            })
            .eq("id", profile.id);

          if (error) throw error;

          toast.success("Location reset to current position");
          navigate("/discover");
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast.error("Could not get your current location");
          setLoading(false);
        }
      );
    } catch (error) {
      console.error("Error resetting location:", error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Passport™ Mode
            </h1>
            <p className="text-sm text-muted-foreground">
              Match with people anywhere in the world
            </p>
          </div>
        </div>
      </div>

      {/* Premium upsell for non-subscribers */}
      {!isPremiumUser && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold">Unlock Passport™ Mode</p>
              <p className="text-sm opacity-90">Travel virtually & meet people worldwide</p>
            </div>
            <button
              onClick={() => navigate("/premium")}
              className="px-4 py-2 bg-white text-purple-600 rounded-full font-semibold text-sm"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Search results */}
      {filteredCities && (
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {filteredCities.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No cities found
              </div>
            ) : (
              filteredCities.map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleSelectLocation(city)}
                  disabled={loading || !isPremiumUser}
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 disabled:opacity-50"
                >
                  <MapPin className="w-5 h-5 text-primary" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">{city.name}</p>
                    <p className="text-sm text-muted-foreground">{city.country}</p>
                  </div>
                  {selectedLocation?.id === city.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Reset to current location */}
      {isPremiumUser && (
        <div className="px-4 mb-4">
          <button
            onClick={handleResetLocation}
            disabled={loading}
            className="w-full p-4 flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Use Current Location</p>
              <p className="text-sm text-muted-foreground">Reset to your actual position</p>
            </div>
          </button>
        </div>
      )}

      {/* Popular Destinations */}
      {!filteredCities && (
        <>
          {/* Cuban Cities */}
          <div className="px-4 mb-6">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              🇨🇺 Cuba
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {cubanCities.slice(0, 4).map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleSelectLocation(city)}
                  disabled={loading || !isPremiumUser}
                  className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left disabled:opacity-50"
                >
                  <p className="font-semibold text-foreground">{city.name}</p>
                  {city.popular && (
                    <span className="text-xs text-primary">Popular</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSearchQuery("Cuba")}
              className="w-full mt-2 py-2 text-primary text-sm font-medium"
            >
              See all Cuban cities →
            </button>
          </div>

          {/* International */}
          <div className="px-4 mb-6">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              🌎 International
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {internationalCities.filter(c => c.popular).map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleSelectLocation(city)}
                  disabled={loading || !isPremiumUser}
                  className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left disabled:opacity-50"
                >
                  <p className="font-semibold text-foreground">{city.name}</p>
                  <p className="text-xs text-muted-foreground">{city.country}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
