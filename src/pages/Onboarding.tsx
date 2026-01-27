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
    title: "Find Your Perfect Match",
    description: "Connect with amazing people from Cuba and around the world. Our smart matching algorithm helps you find compatible connections.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: <Users className="w-12 h-12" />,
    title: "Verified Profiles",
    description: "All profiles are verified for authenticity. Feel confident knowing you're connecting with real people.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: <Shield className="w-12 h-12" />,
    title: "Safe & Secure",
    description: "Your privacy and safety are our top priorities. Chat and video call securely with built-in protections.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: <Sparkles className="w-12 h-12" />,
    title: "Premium Features",
    description: "Video calls, unlimited likes, see who likes you, and more. Experience dating without limits.",
    color: "from-purple-500 to-violet-500",
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="p-4">
        <Progress value={progress} className="h-1" />
      </div>

      {/* Skip button */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/auth")}
          className="text-muted-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            {/* Icon */}
            <div
              className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-br ${slide.color} flex items-center justify-center mb-8 text-white shadow-2xl`}
            >
              {slide.icon}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-foreground mb-4">
              {slide.title}
            </h1>

            {/* Description */}
            <p className="text-muted-foreground text-lg max-w-sm mx-auto">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mb-8">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              index === currentSlide
                ? "bg-primary w-8"
                : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="p-6 flex gap-4">
        {currentSlide > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={prevSlide}
            className="flex-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
        )}
        <Button
          size="lg"
          onClick={nextSlide}
          className={`flex-1 ${currentSlide === 0 ? "w-full" : ""}`}
        >
          {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
