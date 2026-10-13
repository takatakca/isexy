import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Search, Check, Globe, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemberSettings } from "@/hooks/useMemberSettings";
import { goBack } from "@/lib/navigation";

interface Location {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  popular?: boolean;
}

const canadianCities: Location[] = [
  { id: "montreal", name: "Montréal", country: "Canada", latitude: 45.5017, longitude: -73.5673, popular: true },
  { id: "toronto", name: "Toronto", country: "Canada", latitude: 43.6532, longitude: -79.3832, popular: true },
  { id: "vancouver", name: "Vancouver", country: "Canada", latitude: 49.2827, longitude: -123.1207, popular: true },
  { id: "quebec", name: "Québec City", country: "Canada", latitude: 46.8139, longitude: -71.2080, popular: true },
  { id: "ottawa", name: "Ottawa", country: "Canada", latitude: 45.4215, longitude: -75.6972 },
  { id: "calgary", name: "Calgary", country: "Canada", latitude: 51.0447, longitude: -114.0719 },
  { id: "edmonton", name: "Edmonton", country: "Canada", latitude: 53.5461, longitude: -113.4938 },
  { id: "winnipeg", name: "Winnipeg", country: "Canada", latitude: 49.8951, longitude: -97.1384 },
  { id: "halifax", name: "Halifax", country: "Canada", latitude: 44.6488, longitude: -63.5752 },
];

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
  { id: "mexico", name: "Mexico City", country: "Mexico", latitude: 19.4326, longitude: -99.1332, popular: true },
  { id: "madrid", name: "Madrid", country: "Spain", latitude: 40.4168, longitude: -3.7038 },
  { id: "cancun", name: "Cancún", country: "Mexico", latitude: 21.1619, longitude: -86.8515 },
  { id: "newyork", name: "New York", country: "USA", latitude: 40.7128, longitude: -74.0060 },
  { id: "losangeles", name: "Los Angeles", country: "USA", latitude: 34.0522, longitude: -118.2437 },
];

export default function PassportMode() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  // Remembers the member's own city so "Use Current Location" can put it back.
  const { settings, save } = useMemberSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);

  const isPremiumUser = profile?.subscription_tier === 'plus' || 
                         profile?.subscription_tier === 'gold' || 
                         profile?.subscription_tier === 'platinum';

  const allCities = [...canadianCities, ...cubanCities, ...internationalCities];
  
  // Accent-insensitive: "montreal" finds Montréal, "quebec" finds Québec City.
  const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = fold(searchQuery.trim());
  const filteredCities = query
    ? allCities.filter((city) => fold(city.name).includes(query) || fold(city.country).includes(query))
    : null;

  const handleSelectLocation = async (location: Location) => {
    if (!isPremiumUser) {
      navigate("/premium");
      return;
    }

    if (!profile?.id) return;

    setLoading(true);
    setSelectedLocation(location);

    try {
      // First trip away from home: keep the member's own city to restore later.
      const homeCity = settings.passport ? settings.passport.homeCity : profile.city ?? null;
      if (!settings.passport) await save({ passport: { homeCity } });

      const { error } = await supabase
        .from("profiles")
        .update({
          latitude: location.latitude,
          longitude: location.longitude,
          city: location.name,
        })
        .eq("id", profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success(`Location changed to ${location.name}, ${location.country}`);
      navigate("/discover");
    } catch (error) {
      console.error("Error updating location:", error);
      toast.error("Failed to update location");
    } finally {
      setLoading(false);
    }
  };

  const handleResetLocation = () => {
    if (!profile?.id) return;
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't available on this device");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // Back home: the member's own city again (Passport replaced it with the destination).
        const city = settings.passport ? settings.passport.homeCity ?? null : profile.city ?? null;
        const { error } = await supabase
          .from("profiles")
          .update({
            // About 1 km precision, as at signup.
            latitude: Math.round(position.coords.latitude * 100) / 100,
            longitude: Math.round(position.coords.longitude * 100) / 100,
            city,
          })
          .eq("id", profile.id);

        if (error) {
          console.error("Error resetting location:", error);
          toast.error("Failed to update location");
          setLoading(false);
          return;
        }

        if (settings.passport) await save({ passport: undefined });
        await refreshProfile();
        setLoading(false);
        toast.success("Location reset to current position");
        navigate("/discover");
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Could not get your current location");
        setLoading(false);
      },
      { timeout: 15000 }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => goBack(navigate, "/settings")} className="p-1" aria-label="Go back">
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
                  disabled={loading}
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
          {/* Canadian Cities */}
          <div className="px-4 mb-6">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              🇨🇦 Canada
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {canadianCities.filter((c) => c.popular).map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleSelectLocation(city)}
                  disabled={loading}
                  className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left disabled:opacity-50"
                >
                  <p className="font-semibold text-foreground">{city.name}</p>
                  <span className="text-xs text-primary">Popular</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setSearchQuery("Canada")}
              className="w-full mt-2 py-2 text-primary text-sm font-medium"
            >
              See all Canadian cities →
            </button>
          </div>

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
                  disabled={loading}
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
                  disabled={loading}
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
