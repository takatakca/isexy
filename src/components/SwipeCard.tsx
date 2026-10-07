import { forwardRef, useState, type CSSProperties } from "react";
import { MapPin, Briefcase, GraduationCap, BadgeCheck, Languages, Heart, X, Star, Info } from "lucide-react";

export interface SwipeCardProfile {
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
  profile: SwipeCardProfile;
  /** Card behind the top one: no interaction, slightly scaled. */
  isBehind?: boolean;
  onOpenDetails?: () => void;
  style?: CSSProperties;
}

/**
 * One profile card. The top card's gesture is driven by useSwipeGesture,
 * which sets --like / --nope / --super on this element; the badges below
 * read those variables, so they fade in without React re-rendering.
 */
export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(function SwipeCard(
  { profile, isBehind = false, onOpenDetails, style },
  ref,
) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = profile.photos;
  const photo = photos[Math.min(photoIndex, photos.length - 1)];

  const step = (delta: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((i) => Math.min(Math.max(0, i + delta), photos.length - 1));
  };

  return (
    <div
      ref={ref}
      aria-hidden={isBehind || undefined}
      className="absolute inset-0 rounded-3xl overflow-hidden bg-card select-none"
      style={{
        touchAction: isBehind ? undefined : "none",
        willChange: isBehind ? undefined : "transform",
        transform: isBehind ? "scale(0.95) translateY(10px)" : undefined,
        transition: isBehind ? "transform 260ms ease-out" : undefined,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px hsl(var(--border))",
        ...style,
      }}
    >
      {/* Photo progress */}
      {photos.length > 1 && (
        <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-20" aria-hidden>
          {photos.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full overflow-hidden bg-white/25">
              <div className={`h-full bg-white transition-all duration-200 ${i <= photoIndex ? "w-full" : "w-0"} ${i < photoIndex ? "opacity-60" : ""}`} />
            </div>
          ))}
        </div>
      )}

      {photo ? (
        <img
          src={photo}
          alt={`${profile.first_name}, ${profile.age}`}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
          decoding="async"
          loading={isBehind ? "lazy" : "eager"}
        />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <span className="text-7xl font-extrabold text-muted-foreground">{profile.first_name[0]}</span>
        </div>
      )}

      {/* Tap zones: previous / next photo */}
      {!isBehind && photos.length > 1 && (
        <div className="absolute inset-x-0 top-0 bottom-36 z-10 flex">
          <button type="button" className="flex-1" onClick={step(-1)} aria-label="Previous photo" />
          <button type="button" className="flex-1" onClick={step(1)} aria-label="Next photo" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

      {!isBehind && (
        <>
          <div style={{ opacity: "var(--like, 0)" }} className="pointer-events-none absolute top-16 left-6 px-5 py-2 rounded-2xl bg-emerald-500/15 border-2 border-emerald-400 text-emerald-300 font-extrabold text-2xl -rotate-12 z-30 backdrop-blur-sm flex items-center gap-2">
            <Heart className="w-6 h-6 fill-current" /> LIKE
          </div>
          <div style={{ opacity: "var(--nope, 0)" }} className="pointer-events-none absolute top-16 right-6 px-5 py-2 rounded-2xl bg-rose-500/15 border-2 border-rose-400 text-rose-300 font-extrabold text-2xl rotate-12 z-30 backdrop-blur-sm flex items-center gap-2">
            <X className="w-6 h-6" /> NOPE
          </div>
          <div style={{ opacity: "var(--super, 0)" }} className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 px-6 py-2 rounded-2xl bg-cyan-500/15 border-2 border-cyan-400 text-cyan-300 font-extrabold text-2xl z-30 backdrop-blur-sm flex items-center gap-2">
            <Star className="w-6 h-6 fill-current" /> SUPER
          </div>
        </>
      )}

      <div className="absolute bottom-0 inset-x-0 p-5 pb-6 text-white z-20">
        <div className="flex items-end gap-2 mb-2 pr-12">
          <h2 className="text-3xl font-extrabold leading-none tracking-tight truncate">{profile.first_name}</h2>
          <span className="text-2xl font-light leading-none opacity-90">{profile.age}</span>
          {profile.is_verified && <BadgeCheck className="w-6 h-6 text-cyan-300 fill-cyan-400/20 mb-0.5 shrink-0" aria-label="Verified" />}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/85 mb-2">
          {profile.distance != null ? (
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.distance < 1 ? "< 1" : profile.distance} km{profile.city ? ` · ${profile.city}` : ""}</span>
          ) : profile.city ? (
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.city}</span>
          ) : null}
          {profile.job_title && (
            <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{profile.job_title}{profile.company ? ` · ${profile.company}` : ""}</span>
          )}
          {profile.school && <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" />{profile.school}</span>}
        </div>

        {profile.bio && (
          <p className="text-white/95 text-sm leading-snug line-clamp-2 pr-12">{profile.translatedBio || profile.bio}</p>
        )}
        {profile.translatedBio && (
          <p className="flex items-center gap-1 mt-1 text-white/60 text-xs"><Languages className="w-3 h-3" />Translated</p>
        )}

        {!isBehind && onOpenDetails && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenDetails(); }}
            className="absolute right-4 bottom-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30"
            aria-label={`Open ${profile.first_name}'s profile`}
          >
            <Info className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
});
