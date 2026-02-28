import { useState } from "react";
import { ArrowLeft, MapPin, Briefcase, GraduationCap, BadgeCheck, Heart, X, Star, Languages } from "lucide-react";

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
  interests?: string[];
}

interface ProfileDetailProps {
  profile: Profile;
  onClose: () => void;
  onLike: () => void;
  onPass: () => void;
  onSuperLike: () => void;
}

export function ProfileDetail({ profile, onClose, onLike, onPass, onSuperLike }: ProfileDetailProps) {
  const [currentPhoto, setCurrentPhoto] = useState(0);

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Back button */}
      <button
        onClick={onClose}
        className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md flex items-center justify-center border border-border"
      >
        <ArrowLeft className="w-5 h-5 text-foreground" />
      </button>

      {/* Photos */}
      <div className="relative w-full aspect-[3/4]">
        {profile.photos[currentPhoto] ? (
          <img
            src={profile.photos[currentPhoto]}
            alt={profile.first_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-6xl font-bold text-muted-foreground">{profile.first_name[0]}</span>
          </div>
        )}

        {/* Photo indicators */}
        <div className="absolute top-2 left-2 right-2 flex gap-1">
          {profile.photos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPhoto(idx)}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx === currentPhoto ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Info */}
      <div className="px-4 -mt-12 relative z-10 pb-32">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold text-foreground">
            {profile.first_name}, {profile.age}
          </h1>
          {profile.is_verified && (
            <BadgeCheck className="w-7 h-7 text-cyan-400 fill-cyan-400" />
          )}
        </div>

        {profile.distance && (
          <p className="text-muted-foreground text-sm flex items-center gap-1 mb-2">
            <MapPin className="w-4 h-4" />
            {profile.distance} km away
          </p>
        )}

        {(profile.job_title || profile.company) && (
          <p className="text-muted-foreground text-sm flex items-center gap-1 mb-2">
            <Briefcase className="w-4 h-4" />
            {profile.job_title}{profile.company && ` at ${profile.company}`}
          </p>
        )}

        {profile.school && (
          <p className="text-muted-foreground text-sm flex items-center gap-1 mb-2">
            <GraduationCap className="w-4 h-4" />
            {profile.school}
          </p>
        )}

        {profile.bio && (
          <div className="mt-4">
            <h3 className="font-semibold text-foreground mb-1">About</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {profile.translatedBio || profile.bio}
            </p>
            {profile.translatedBio && (
              <div className="flex items-center gap-1 mt-1 text-muted-foreground/60 text-xs">
                <Languages className="w-3 h-3" />
                <span>Translated</span>
              </div>
            )}
          </div>
        )}

        {profile.interests && profile.interests.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-foreground mb-2">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <span
                  key={interest}
                  className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-6 left-0 right-0 flex items-center justify-center gap-4 z-50">
        <button
          onClick={onPass}
          className="w-16 h-16 rounded-full bg-card shadow-lg flex items-center justify-center border border-border"
        >
          <X className="w-8 h-8 text-rose-500" />
        </button>
        <button
          onClick={onSuperLike}
          className="w-12 h-12 rounded-full bg-card shadow-lg flex items-center justify-center border border-border"
        >
          <Star className="w-5 h-5 text-cyan-400 fill-cyan-400" />
        </button>
        <button
          onClick={onLike}
          className="w-16 h-16 rounded-full bg-card shadow-lg flex items-center justify-center border border-border"
        >
          <Heart className="w-8 h-8 text-green-500 fill-green-500" />
        </button>
      </div>
    </div>
  );
}
