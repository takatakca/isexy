import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";
import PhoneAuth from "./pages/PhoneAuth";
import CodeVerification from "./pages/CodeVerification";
import HouseRules from "./pages/HouseRules";
import ProfileSetup from "./pages/ProfileSetup";
import Discover from "./pages/Discover";
import Explore from "./pages/Explore";
import Likes from "./pages/Likes";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Premium from "./pages/Premium";
import EditBio from "./pages/EditBio";
import GetSuperLikes from "./pages/GetSuperLikes";
import MySubscription from "./pages/MySubscription";
import Safety from "./pages/Safety";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import LoveStories from "./pages/LoveStories";
import About from "./pages/About";
import News from "./pages/News";
import Matches from "./pages/Matches";
import Interests from "./pages/Interests";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/phone" element={<PhoneAuth />} />
            <Route path="/verify" element={<CodeVerification />} />
            <Route path="/house-rules" element={<HouseRules />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/likes" element={<Likes />} />
            <Route path="/matches" element={<Messages />} />
            <Route path="/chat/:matchId" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/edit-bio" element={<EditBio />} />
            <Route path="/super-likes" element={<GetSuperLikes />} />
            <Route path="/my-subscription" element={<MySubscription />} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/love-stories" element={<LoveStories />} />
            <Route path="/about" element={<About />} />
            <Route path="/news" element={<News />} />
            <Route path="/matches-list" element={<Matches />} />
            <Route path="/interests" element={<Interests />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
