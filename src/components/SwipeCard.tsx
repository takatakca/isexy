import { useState } from "react";
import { MapPin, Briefcase, GraduationCap, BadgeCheck, Languages, Heart, X, Star } from "lucide-react";

interface Profile {
  id: string;
  first_name: string;
  age: number;
  bio?: string;
  translatedBio?: string;
  city?: string;
  job_title?: string;
  company?: string;
  school?: string;
  is_verified?: boolean;
  distance?: number;
  photos: string[];
}

interface SwipeCardProps {
  profile: Profile;
  style?: React.CSSProperties;
  onImageTap?: (direction: "left" | "right") => void;
  showLikeIndicator?: boolean;
  showNopeIndicator?: boolean;
  showSuperLikeIndicator?: boolean;
}

export function SwipeCard({
  profile,
  style,
  showLikeIndicator,
  showNopeIndicator,
  showSuperLikeIndicator,
}: SwipeCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const handleImageTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isRightSide = e.clientX - rect.left > rect.width / 2;
    if (isRightSide && currentImageIndex < profile.photos.length - 1) {
      setCurrentImageIndex((prev) => prev + 1);
    } else if (!isRightSide && currentImageIndex > 0) {
      setCurrentImageIndex((prev) => prev - 1);
    }
  };

  return (
    <div
      className="absolute inset-0 rounded-3xl overflow-hidden bg-card select-none"
      style={{
        ...style,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px hsl(var(--border))",
      }}
    >
      {/* Photo progress bars */}
      <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-20">
        {profile.photos.map((_, idx) => (
          <div key={idx} className="h-1 flex-1 rounded-full overflow-hidden bg-white/25">
            <div
              className={`h-full bg-white transition-all duration-300 ${
                idx === currentImageIndex ? "w-full" : idx < currentImageIndex ? "w-full opacity-60" : "w-0"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Main image */}
      <div className="absolute inset-0" onClick={handleImageTap}>
        {profile.photos[currentImageIndex] ? (
          <img
            src={profile.photos[currentImageIndex]}
            alt={profile.first_name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-7xl font-extrabold text-muted-foreground">
              {profile.first_name[0]}
            </span>
          </div>
        )}
      </div>

      {/* Richer gradient for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

      {/* Swipe indicators — premium pill style */}
      {showLikeIndicator && (
        <div className="absolute top-20 left-6 px-5 py-2 rounded-2xl bg-emerald-500/15 border-2 border-emerald-400 text-emerald-300 font-extrabold text-2xl -rotate-12 z-30 backdrop-blur-sm flex items-center gap-2">
          <Heart className="w-6 h-6 fill-current" /> LIKE
        </div>
      )}
      {showNopeIndicator && (
        <div className="absolute top-20 right-6 px-5 py-2 rounded-2xl bg-rose-500/15 border-2 border-rose-400 text-rose-300 font-extrabold text-2xl rotate-12 z-30 backdrop-blur-sm flex items-center gap-2">
          <X className="w-6 h-6" /> NOPE
        </div>
      )}
      {showSuperLikeIndicator && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 px-6 py-2 rounded-2xl bg-cyan-500/15 border-2 border-cyan-400 text-cyan-300 font-extrabold text-2xl z-30 backdrop-blur-sm flex items-center gap-2">
          <Star className="w-6 h-6 fill-current" /> SUPER
        </div>
      )}

      {/* Profile info */}
      <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 text-white z-10">
        <div className="flex items-end gap-2 mb-2">
          <h2 className="text-3xl font-extrabold leading-none tracking-tight">
            {profile.first_name}
          </h2>
          <span className="text-2xl font-light leading-none opacity-90">{profile.age}</span>
          {profile.is_verified && (
            <BadgeCheck className="w-6 h-6 text-cyan-300 fill-cyan-400/20 ml-1 mb-0.5" />
          )}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/85 mb-2">
          {profile.distance != null && (
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.distance} km</span>
          )}
          {profile.city && !profile.distance && (
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.city}</span>
          )}
          {profile.job_title && (
            <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{profile.job_title}{profile.company ? ` · ${profile.company}` : ""}</span>
          )}
          {profile.school && (
            <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" />{profile.school}</span>
          )}
        </div>

        {profile.bio && (
          <button onClick={() => setShowInfo(!showInfo)} className="mt-1 text-left w-full" aria-label="Toggle bio">
            <p className={`text-white/95 text-sm leading-snug ${showInfo ? "" : "line-clamp-2"}`}>
              {profile.translatedBio || profile.bio}
            </p>
            {profile.translatedBio && (
              <div className="flex items-center gap-1 mt-1 text-white/60 text-xs">
                <Languages className="w-3 h-3" /><span>Translated</span>
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
