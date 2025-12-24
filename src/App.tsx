import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ConsumerHealthPrivacy from "./pages/ConsumerHealthPrivacy";
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
import EditProfile from "./pages/EditProfile";
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
import BlockContacts from "./pages/BlockContacts";
import DarkMode from "./pages/DarkMode";
import AutoplayVideos from "./pages/AutoplayVideos";
import TopPicks from "./pages/TopPicks";
import CommunityGuidelines from "./pages/CommunityGuidelines";
import SafetyTips from "./pages/SafetyTips";
import CookiePolicy from "./pages/CookiePolicy";
import SwipeSurge from "./pages/SwipeSurge";
import ActiveStatus from "./pages/ActiveStatus";
import FriendsInCommon from "./pages/FriendsInCommon";
import EmailSettings from "./pages/EmailSettings";
import PushNotifications from "./pages/PushNotifications";
import TeamCubaDate from "./pages/TeamCubaDate";
import ManagePaymentAccount from "./pages/ManagePaymentAccount";
import RestorePurchase from "./pages/RestorePurchase";
import HelpSupport from "./pages/HelpSupport";
import WebProfile from "./pages/WebProfile";
import DeleteAccount from "./pages/DeleteAccount";
import Licenses from "./pages/Licenses";
import FAQ from "./pages/FAQ";
import ContactUs from "./pages/ContactUs";
import TicketTracking from "./pages/TicketTracking";
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
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/get-super-likes" element={<GetSuperLikes />} />
            <Route path="/my-subscription" element={<MySubscription />} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/love-stories" element={<LoveStories />} />
            <Route path="/about" element={<About />} />
            <Route path="/news" element={<News />} />
            <Route path="/matches-list" element={<Matches />} />
            <Route path="/interests" element={<Interests />} />
            <Route path="/block-contacts" element={<BlockContacts />} />
            <Route path="/dark-mode" element={<DarkMode />} />
            <Route path="/autoplay-videos" element={<AutoplayVideos />} />
            <Route path="/top-picks" element={<TopPicks />} />
            <Route path="/community-guidelines" element={<CommunityGuidelines />} />
            <Route path="/safety-tips" element={<SafetyTips />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/swipe-surge" element={<SwipeSurge />} />
            <Route path="/active-status" element={<ActiveStatus />} />
            <Route path="/friends-in-common" element={<FriendsInCommon />} />
            <Route path="/email-settings" element={<EmailSettings />} />
            <Route path="/push-notifications" element={<PushNotifications />} />
            <Route path="/team-cubadate" element={<TeamCubaDate />} />
            <Route path="/manage-payment-account" element={<ManagePaymentAccount />} />
            <Route path="/restore-purchase" element={<RestorePurchase />} />
            <Route path="/help-support" element={<HelpSupport />} />
            <Route path="/web-profile" element={<WebProfile />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/licenses" element={<Licenses />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/ticket-tracking" element={<TicketTracking />} />
            <Route path="/consumer-health-privacy" element={<ConsumerHealthPrivacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
