import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Quote, ChevronLeft, ChevronRight } from "lucide-react";

const successStories = [
  {
    id: 1,
    names: "Samantha & John",
    image: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=400&h=400&fit=crop",
    location: "Indiana, USA",
    story: "When we met we were exactly 100 miles away. His bio was simply 'Not to brag, but I have a bedframe,' and I just knew our humor clicked. We started off talking for hours every day. I never believed those 'when you know you know' stories, but it literally was just that.",
  },
  {
    id: 2,
    names: "Danielle & Matthew",
    image: "https://images.unsplash.com/photo-1529634597503-139d3726fed5?w=400&h=400&fit=crop",
    location: "New York, USA",
    story: "We matched during the pandemic and our first virtual date lasted 6 hours! We talked about everything from our favorite foods to our dreams. A year later, we're engaged and couldn't be happier.",
  },
  {
    id: 3,
    names: "Kate & Lain",
    image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=400&fit=crop",
    location: "London, UK",
    story: "I almost didn't swipe right because I thought she was out of my league. Best decision I ever made! We bonded over our love for hiking and now we've explored mountains together across three continents.",
  },
  {
    id: 4,
    names: "Kristen & Kelsey",
    image: "https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=400&h=400&fit=crop",
    location: "California, USA",
    story: "We were each other's first match on the app. It felt like fate. Our first date was supposed to be coffee, but we ended up talking until the cafe closed. That was three years ago – now we're planning our wedding!",
  },
  {
    id: 5,
    names: "Sarah & Anthony",
    image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=400&fit=crop",
    location: "Miami, USA",
    story: "He super-liked me, and I thought it was a mistake at first! Turns out it was intentional, and it was the best 'accident' that ever happened to both of us. We're now expecting our first child.",
  },
  {
    id: 6,
    names: "Luana & Gabriel",
    image: "https://images.unsplash.com/photo-1545389336-cf090694435e?w=400&h=400&fit=crop",
    location: "São Paulo, Brazil",
    story: "We matched at exactly midnight on New Year's Eve. Our first message exchange felt like talking to an old friend. Now every New Year's we celebrate two things – the new year and our anniversary!",
  },
];

export default function LoveStories() {
  const navigate = useNavigate();
  const [selectedStory, setSelectedStory] = useState(0);

  const nextStory = () => {
    setSelectedStory((prev) => (prev + 1) % successStories.length);
  };

  const prevStory = () => {
    setSelectedStory((prev) => (prev - 1 + successStories.length) % successStories.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Love Stories</h1>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 py-10 text-center">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Heart className="w-16 h-16 text-primary fill-primary" />
            <Heart className="w-8 h-8 text-rose-400 fill-rose-400 absolute -top-2 -right-2 animate-pulse" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">
          A new relationship starts on CubaDate
        </h2>
        <p className="text-lg text-primary font-semibold">
          every 3 seconds around the globe
        </p>
      </div>

      {/* Featured Story */}
      <div className="px-4 mb-8">
        <div className="bg-card rounded-3xl shadow-lg overflow-hidden">
          <div className="relative aspect-square max-w-sm mx-auto">
            <img
              src={successStories[selectedStory].image}
              alt={successStories[selectedStory].names}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h3 className="text-2xl font-bold">{successStories[selectedStory].names}</h3>
              <p className="text-white/80">{successStories[selectedStory].location}</p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Quote className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
              <p className="text-foreground leading-relaxed">
                {successStories[selectedStory].story}
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                onClick={prevStory}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>
              <div className="flex gap-2">
                {successStories.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedStory(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === selectedStory ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={nextStory}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* All Stories Grid */}
      <div className="px-4 pb-8">
        <h3 className="text-lg font-bold text-foreground mb-4">More Success Stories</h3>
        <div className="grid grid-cols-2 gap-3">
          {successStories.map((story, idx) => (
            <button
              key={story.id}
              onClick={() => setSelectedStory(idx)}
              className={`relative aspect-square rounded-2xl overflow-hidden ${
                idx === selectedStory ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
            >
              <img
                src={story.image}
                alt={story.names}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-white text-left">
                <p className="font-semibold text-sm truncate">{story.names}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-8">
        <button
          onClick={() => navigate("/discover")}
          className="w-full py-4 bg-gradient-to-r from-primary to-rose-500 text-primary-foreground rounded-full font-bold text-lg shadow-lg"
        >
          Start Your Story
        </button>
      </div>
    </div>
  );
}
