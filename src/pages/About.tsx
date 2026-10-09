import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Shield, Globe, Users, Sparkles, BadgeCheck, MapPin, Award, Target, Zap, Star, MessageCircle, Lock, Eye } from "lucide-react";
import { Logo } from "@/components/Logo";

const stats = [
  { value: "18+", label: "Adults Only" },
  { value: "EN · FR", label: "Built for Canada" },
  { value: "Live", label: "Chat Translation" },
  { value: "Free", label: "To Join" },
];

const values = [
  {
    icon: Heart,
    title: "Real Conversations",
    description: "We want people to actually talk. Swipes help you find people with shared interests; chat, phone and video calls help you get to know them and make new friends.",
  },
  {
    icon: Shield,
    title: "Safety First",
    description: "Your safety is our priority. Profile verification, block and report on every profile, moderation and safety tips help keep the community respectful.",
  },
  {
    icon: Users,
    title: "Inclusive Community",
    description: "ISEXY welcomes every adult (18+) who follows our Community Guidelines. We celebrate diversity and want everyone to feel welcome.",
  },
  {
    icon: Sparkles,
    title: "Innovation",
    description: "Live chat translation, webcam video calls, PhoneLine voice messages and an AI help concierge make it easier to talk with people across languages.",
  },
  {
    icon: Lock,
    title: "Privacy & Trust",
    description: "Your data belongs to you. We protect your information and follow Canadian privacy law, including PIPEDA and Québec's Law 25.",
  },
  {
    icon: Target,
    title: "Quality Over Quantity",
    description: "A match only happens when two people both swipe right, so every conversation starts with mutual interest.",
  },
];

const features = [
  {
    icon: BadgeCheck,
    title: "Profile Verification",
    description: "Verification helps confirm members are real and look like their profile photos, reducing fake profiles and impersonation.",
  },
  {
    icon: Globe,
    title: "Passport Mode",
    description: "Discover and talk with people in another city before you travel or move there.",
  },
  {
    icon: Zap,
    title: "Smart Boost",
    description: "Get more visibility when you need it. A Boost shows your profile to more people for a limited time.",
  },
  {
    icon: Star,
    title: "Super Likes",
    description: "Stand out and let someone know you'd really like to talk with them.",
  },
  {
    icon: MessageCircle,
    title: "Icebreakers",
    description: "Not sure what to say? Profile prompts give you easy ways to start a conversation.",
  },
  {
    icon: Eye,
    title: "See Who Likes You",
    description: "Premium members can see who has already swiped right on their profile.",
  },
];

const team = [
  {
    name: "Member Support",
    role: "Help Center & Contact",
    bio: "Answers questions about accounts, billing, verification and the app in English and French.",
  },
  {
    name: "Trust Safety",
    role: "Moderation & Reports",
    bio: "Reviews reports, enforces our Community Guidelines and removes accounts that put members at risk.",
  },
  {
    name: "Product Engineering",
    role: "App & Infrastructure",
    bio: "Builds profiles, swipes, chat with live translation, phone calls and video calls.",
  },
];

const milestones = [
  { year: "Now", event: "Launching in Canada, in English and Canadian French" },
  { year: "Next", event: "Expanding to the rest of North America" },
  { year: "Later", event: "Opening to more countries" },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">About ISEXY</h1>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 py-12 text-center bg-gradient-to-b from-primary/10 to-background">
        <div className="flex justify-center mb-6">
          <Logo size="xl" variant="dark" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Meet New People, Make Friends
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          ISEXY is a social network for adults (18+) in Canada. Create a profile, swipe to find people to talk with, and get to know them through chat, phone calls and video calls.
        </p>
        <div className="flex justify-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            <span>Montréal, QC</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Award className="w-4 h-4 text-primary" />
            <span>18+ only</span>
          </div>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="px-4 py-8">
        <div className="bg-gradient-to-br from-primary/20 to-rose-500/20 rounded-3xl p-6 text-center">
          <h3 className="text-xl font-bold text-foreground mb-4">Our Mission</h3>
          <p className="text-foreground/90 leading-relaxed">
            "To make it easy and safe for adults to meet new people, start real conversations and make friends — whatever language they speak."
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-8">
        <h3 className="text-xl font-bold text-foreground mb-6 text-center">At a Glance</h3>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-2xl p-4 text-center border border-border"
            >
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Our Story */}
      <div className="px-4 py-8 bg-muted/30">
        <h3 className="text-xl font-bold text-foreground mb-6">Our Story</h3>
        <div className="space-y-4 text-muted-foreground">
          <p>
            ISEXY was born from a simple observation: even in a connected world, many adults find it hard to meet new people and make friends. We set out to build a social network that makes starting a real conversation simple and safe.
          </p>
          <p>
            We are starting in Canada, in English and Canadian French, and plan to grow to the rest of North America and other countries later. Our mission stays the same: help people meet, talk and become friends.
          </p>
          <p>
            Members swipe to find people they would like to talk with. When two people both swipe right, it's a match and they can chat — with live translation — then move to a phone or video call when they're both ready.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 py-8">
        <h3 className="text-xl font-bold text-foreground mb-6">Our Journey</h3>
        <div className="space-y-4">
          {milestones.map((milestone, index) => (
            <div key={index} className="flex gap-4">
              <div className="w-16 shrink-0">
                <span className="text-sm font-bold text-primary">{milestone.year}</span>
              </div>
              <div className="flex-1 pb-4 border-l-2 border-primary/30 pl-4 relative">
                <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1" />
                <p className="text-sm text-muted-foreground">{milestone.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Our Values */}
      <div className="px-4 py-8 bg-muted/30">
        <h3 className="text-xl font-bold text-foreground mb-6">Our Values</h3>
        <div className="space-y-4">
          {values.map((value) => (
            <div
              key={value.title}
              className="flex gap-4 p-4 bg-card rounded-2xl border border-border"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <value.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">{value.title}</h4>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Features */}
      <div className="px-4 py-8">
        <h3 className="text-xl font-bold text-foreground mb-6">Key Features</h3>
        <div className="space-y-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex gap-4 p-4 bg-card rounded-2xl border border-border"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Our Teams */}
      <div className="px-4 py-8 bg-muted/30">
        <h3 className="text-xl font-bold text-foreground mb-6">Our Teams</h3>
        <div className="grid grid-cols-1 gap-4">
          {team.map((member) => (
            <div
              key={member.name}
              className="p-4 bg-card rounded-2xl border border-border"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">{member.name}</h4>
                  <p className="text-sm text-primary">{member.role}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Company Info */}
      <div className="px-4 py-8">
        <h3 className="text-xl font-bold text-foreground mb-6">Company Information</h3>
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Company Name</span>
            <span className="text-foreground font-medium">ISEXY Inc.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Launch Market</span>
            <span className="text-foreground font-medium">Canada</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Headquarters</span>
            <span className="text-foreground font-medium">Montréal, Québec, Canada</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Languages</span>
            <span className="text-foreground font-medium">English, French</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Minimum Age</span>
            <span className="text-foreground font-medium">18+</span>
          </div>
        </div>
      </div>

      {/* Community Stories CTA */}
      <div className="px-4 py-8">
        <div className="bg-gradient-to-r from-primary to-rose-500 rounded-2xl p-6 text-center">
          <Heart className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold text-primary-foreground mb-2">
            Community Stories
          </h3>
          <p className="text-primary-foreground/80 mb-4">
            Read stories from members about friendships that started on ISEXY.
          </p>
          <button
            onClick={() => navigate("/community-stories")}
            className="px-6 py-3 bg-white text-primary rounded-full font-bold"
          >
            Read Stories
          </button>
        </div>
      </div>

      {/* Contact */}
      <div className="px-4 py-8 bg-muted/30">
        <h3 className="text-xl font-bold text-foreground mb-6">Get in Touch</h3>
        <div className="space-y-4">
          <button
            onClick={() => navigate("/help-support")}
            className="w-full p-4 bg-card rounded-2xl border border-border text-left"
          >
            <h4 className="font-semibold text-foreground">Help & Support</h4>
            <p className="text-sm text-muted-foreground">Questions? We're here to help.</p>
          </button>
          <button
            onClick={() => navigate("/safety")}
            className="w-full p-4 bg-card rounded-2xl border border-border text-left"
          >
            <h4 className="font-semibold text-foreground">Safety Center</h4>
            <p className="text-sm text-muted-foreground">Learn about our safety features.</p>
          </button>
          <button
            onClick={() => navigate("/community-guidelines")}
            className="w-full p-4 bg-card rounded-2xl border border-border text-left"
          >
            <h4 className="font-semibold text-foreground">Community Guidelines</h4>
            <p className="text-sm text-muted-foreground">Our standards for the community.</p>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-8 text-center border-t border-border">
        <p className="text-sm text-muted-foreground mb-4">
          © 2025 ISEXY Inc. All rights reserved.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate("/terms")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Terms
          </button>
          <button
            onClick={() => navigate("/privacy")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy
          </button>
          <button
            onClick={() => navigate("/safety")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Safety
          </button>
          <button
            onClick={() => navigate("/cookie-policy")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cookies
          </button>
          <button
            onClick={() => navigate("/licenses")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Licenses
          </button>
        </div>
      </div>
    </div>
  );
}
