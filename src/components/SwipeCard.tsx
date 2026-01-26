import { useState } from "react";
import { MapPin, Briefcase, GraduationCap, BadgeCheck, Languages } from "lucide-react";

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
  onImageTap,
  showLikeIndicator,
  showNopeIndicator,
  showSuperLikeIndicator,
}: SwipeCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const handleImageTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isRightSide = x > rect.width / 2;

    if (isRightSide) {
      if (currentImageIndex < profile.photos.length - 1) {
        setCurrentImageIndex((prev) => prev + 1);
      }
    } else {
      if (currentImageIndex > 0) {
        setCurrentImageIndex((prev) => prev - 1);
      }
    }
  };

  return (
    <div
      className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl bg-card select-none"
      style={style}
    >
      {/* Image segments indicator */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
        {profile.photos.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 flex-1 rounded-full transition-colors ${
              idx === currentImageIndex ? "bg-white" : "bg-white/40"
            }`}
          />
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
            <span className="text-6xl font-bold text-muted-foreground">
              {profile.first_name[0]}
            </span>
          </div>
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

      {/* Swipe indicators */}
      {showLikeIndicator && (
        <div className="absolute top-24 left-6 px-6 py-3 border-4 border-green-500 text-green-500 font-bold text-3xl -rotate-12 z-30">
          LIKE
        </div>
      )}
      {showNopeIndicator && (
        <div className="absolute top-24 right-6 px-6 py-3 border-4 border-rose-500 text-rose-500 font-bold text-3xl rotate-12 z-30">
          NOPE
        </div>
      )}
      {showSuperLikeIndicator && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 px-6 py-3 border-4 border-cyan-400 text-cyan-400 font-bold text-3xl z-30">
          SUPER LIKE
        </div>
      )}

      {/* Profile info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white z-10">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold">
            {profile.first_name}, {profile.age}
          </h2>
          {profile.is_verified && (
            <BadgeCheck className="w-6 h-6 text-cyan-400 fill-cyan-400" />
          )}
        </div>

        {profile.distance && (
          <p className="text-white/80 text-sm flex items-center gap-1 mb-1">
            <MapPin className="w-3 h-3" />
            {profile.distance} km away
          </p>
        )}

        {(profile.job_title || profile.company) && (
          <p className="text-white/80 text-sm flex items-center gap-1 mb-1">
            <Briefcase className="w-3 h-3" />
            {profile.job_title}
            {profile.company && ` at ${profile.company}`}
          </p>
        )}

        {profile.school && (
          <p className="text-white/80 text-sm flex items-center gap-1">
            <GraduationCap className="w-3 h-3" />
            {profile.school}
          </p>
        )}

        {profile.bio && (
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="mt-2 text-left"
          >
            <p className={`text-white/90 text-sm ${showInfo ? "" : "line-clamp-2"}`}>
              {profile.translatedBio || profile.bio}
            </p>
            {profile.translatedBio && (
              <div className="flex items-center gap-1 mt-1 text-white/60 text-xs">
                <Languages className="w-3 h-3" />
                <span>Translated</span>
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
