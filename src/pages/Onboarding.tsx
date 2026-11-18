import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Heart, Users, Shield, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  image?: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: <Heart className="w-12 h-12" />,
    title: "Find People to Talk To",
    description: "Meet adults across Canada, Cuba and around the world. Swipe to find people you'd like to talk to, chat with live translation, and make new friends.",
    color: "from-primary-solid to-[hsl(var(--gradient-end))]",
  },
  {
    icon: <Users className="w-12 h-12" />,
    title: "Verified Profiles",
    description: "Look for the verified badge: members can verify their photos so you know you're talking with real people.",
    color: "from-[hsl(var(--gradient-end))] to-primary-solid",
  },
  {
    icon: <Shield className="w-12 h-12" />,
    title: "Safe & Secure",
    description: "Your privacy and safety are our top priorities. Chat and video call securely with built-in protections.",
    color: "from-primary-solid to-[hsl(var(--gradient-end))]",
  },
  {
    icon: <Sparkles className="w-12 h-12" />,
    title: "Premium Features",
    description: "Video calls, unlimited likes, see who likes you, and more. Make new friends without limits.",
    color: "from-[hsl(var(--gradient-end))] to-primary-solid",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate("/auth");
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = slides[currentSlide];
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className="min-h-[100dvh] brand-ambient flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Progress + skip */}
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-5 pt-4">
        <Progress value={progress} className="h-1.5 flex-1 bg-foreground/10" aria-label={`Step ${currentSlide + 1} of ${slides.length}`} />
        <Button
          variant="ghost"
          onClick={() => navigate("/auth")}
          className="-mr-2 rounded-full text-muted-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="text-center max-w-md"
          >
            {/* Icon orb */}
            <div className="relative mx-auto mb-10 h-40 w-40">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
              <div className="absolute inset-0 rounded-full border border-primary/25" />
              <div className="absolute inset-4 rounded-full border border-primary/35" />
              <div className={`absolute inset-8 rounded-full bg-gradient-to-br ${slide.color} flex items-center justify-center text-white shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.9)] [&_svg]:h-11 [&_svg]:w-11`}>
                {slide.icon}
              </div>
            </div>

            <p className="eyebrow mb-3">Step {currentSlide + 1} of {slides.length}</p>
            <h1 className="type-title text-foreground mb-4">
              {slide.title}
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1 mb-4">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            aria-label={`Slide ${index + 1} of ${slides.length}`}
            aria-current={index === currentSlide ? "step" : undefined}
            className="flex h-11 items-center justify-center px-1"
          >
            <span className={`block h-2 rounded-full transition-all duration-300 ${index === currentSlide ? "w-8 bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.8)]" : "w-2 bg-muted-foreground/40"}`} />
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="mx-auto flex w-full max-w-lg gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {currentSlide > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={prevSlide}
            className="h-14 flex-1 rounded-full"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
        )}
        <Button
          size="lg"
          onClick={nextSlide}
          className={`h-14 flex-1 rounded-full gradient-primary ${currentSlide === 0 ? "w-full" : ""}`}
        >
          {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
