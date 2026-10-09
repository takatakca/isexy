import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
const ConsumerHealthPrivacy = lazy(() => import("./pages/ConsumerHealthPrivacy"));
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import Welcome from "./pages/Welcome";
const Auth = lazy(() => import("./pages/Auth"));
const CubanSignup = lazy(() => import("./pages/CubanSignup"));
const AdminVerifications = lazy(() => import("./pages/AdminVerifications"));
const HouseRules = lazy(() => import("./pages/HouseRules"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Discover = lazy(() => import("./pages/Discover"));
const Explore = lazy(() => import("./pages/Explore"));
const Likes = lazy(() => import("./pages/Likes"));
const Messages = lazy(() => import("./pages/Messages"));
const Chat = lazy(() => import("./pages/Chat"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Premium = lazy(() => import("./pages/Premium"));
const EditBio = lazy(() => import("./pages/EditBio"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const GetSuperLikes = lazy(() => import("./pages/GetSuperLikes"));
const GetBoosts = lazy(() => import("./pages/GetBoosts"));
const MySubscription = lazy(() => import("./pages/MySubscription"));
const Safety = lazy(() => import("./pages/Safety"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const LoveStories = lazy(() => import("./pages/LoveStories"));
const About = lazy(() => import("./pages/About"));
const News = lazy(() => import("./pages/News"));
const Matches = lazy(() => import("./pages/Matches"));
const Interests = lazy(() => import("./pages/Interests"));
const BlockContacts = lazy(() => import("./pages/BlockContacts"));
const DarkMode = lazy(() => import("./pages/DarkMode"));
const AutoplayVideos = lazy(() => import("./pages/AutoplayVideos"));
const TopPicks = lazy(() => import("./pages/TopPicks"));
const CommunityGuidelines = lazy(() => import("./pages/CommunityGuidelines"));
const SafetyTips = lazy(() => import("./pages/SafetyTips"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const SwipeSurge = lazy(() => import("./pages/SwipeSurge"));
const ActiveStatus = lazy(() => import("./pages/ActiveStatus"));
const FriendsInCommon = lazy(() => import("./pages/FriendsInCommon"));
const EmailSettings = lazy(() => import("./pages/EmailSettings"));
const PushNotifications = lazy(() => import("./pages/PushNotifications"));
const TeamCubaDate = lazy(() => import("./pages/TeamCubaDate"));
const ManagePaymentAccount = lazy(() => import("./pages/ManagePaymentAccount"));
const RestorePurchase = lazy(() => import("./pages/RestorePurchase"));
const HelpSupport = lazy(() => import("./pages/HelpSupport"));
const WebProfile = lazy(() => import("./pages/WebProfile"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const Licenses = lazy(() => import("./pages/Licenses"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const TicketTracking = lazy(() => import("./pages/TicketTracking"));
const AdminTickets = lazy(() => import("./pages/AdminTickets"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminDashboardFull = lazy(() => import("./pages/AdminDashboardFull"));
const AdminCategories = lazy(() => import("./pages/AdminCategories"));
const AdminEmailTemplates = lazy(() => import("./pages/AdminEmailTemplates"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const TouristSignup = lazy(() => import("./pages/TouristSignup"));
const WhoLikedYou = lazy(() => import("./pages/WhoLikedYou"));
const PassportMode = lazy(() => import("./pages/PassportMode"));
const PhotoVerification = lazy(() => import("./pages/PhotoVerification"));
const DoubleDate = lazy(() => import("./pages/DoubleDate"));
const QAEvents = lazy(() => import("./pages/QAEvents"));
const Matchmaker = lazy(() => import("./pages/Matchmaker"));
const LoyaltyRewards = lazy(() => import("./pages/LoyaltyRewards"));
const CubanCashout = lazy(() => import("./pages/CubanCashout"));
const CubanRewards = lazy(() => import("./pages/CubanRewards"));
const BlockReportFlow = lazy(() => import("./pages/BlockReportFlow"));
const SubscriptionComparison = lazy(() => import("./pages/SubscriptionComparison"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const VideoCall = lazy(() => import("./pages/VideoCall"));
const DatingRegulations = lazy(() => import("./pages/DatingRegulations"));
const BuyCredits = lazy(() => import("./pages/BuyCredits"));
const BuyMinutes = lazy(() => import("./pages/BuyMinutes"));
const GroupChat = lazy(() => import("./pages/GroupChat"));
const CategorySwipe = lazy(() => import("./pages/CategorySwipe"));
const Referrals = lazy(() => import("./pages/Referrals"));
const ModeratorLogin = lazy(() => import("./pages/ModeratorLogin"));
const SupportPortal = lazy(() => import("./pages/SupportPortal"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AdminKnowledgeBase = lazy(() => import("./pages/AdminKnowledgeBase"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const CubanDonations = lazy(() => import("./pages/CubanDonations"));
const MyStars = lazy(() => import("./pages/MyStars"));
const RedeemCode = lazy(() => import("./pages/RedeemCode"));
const AdminUserManagement = lazy(() => import("./pages/AdminUserManagement"));
const AdminPaymentTests = lazy(() => import("./pages/AdminPaymentTests"));
const PhoneLine = lazy(() => import("./pages/PhoneLine"));
const PhoneLineSetup = lazy(() => import("./pages/PhoneLineSetup"));
const PhoneLineBrowse = lazy(() => import("./pages/PhoneLineBrowse"));
const PhoneLineInbox = lazy(() => import("./pages/PhoneLineInbox"));
const PhoneLineCall = lazy(() => import("./pages/PhoneLineCall"));
const AdminCallTests = lazy(() => import("./pages/AdminCallTests"));
import NotFound from "./pages/NotFound";

import { StreakProvider } from "./components/StreakProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { AIChatWidget } from "./components/AIChatWidget";
import { PushNotificationPrompt } from "./components/PushNotificationPrompt";
import { IncomingCallNotification } from "./components/IncomingCallNotification";
import { RouteSeo } from "./components/RouteSeo";
import { ConsentBanner } from "./components/ConsentBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initAnalytics, trackPageView } from "@/lib/analytics";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

/** Page views on every route change (sent only with analytics consent). */
function RouteAnalytics() {
  const { pathname } = useLocation();
  useEffect(() => { initAnalytics(); }, []);
  useEffect(() => {
    // Let RouteSeo update document.title first.
    const t = window.setTimeout(() => trackPageView(pathname), 0);
    return () => window.clearTimeout(t);
  }, [pathname]);
  return null;
}

/** Error boundary that recovers automatically when the user navigates away. */
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <StreakProvider>
            <RouteSeo />
            <RouteAnalytics />
            <RouteErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route path="/welcome" element={<Navigate to="/" replace />} />
              <Route path="/cookies" element={<Navigate to="/cookie-policy" replace />} />
              <Route path="/messages" element={<Navigate to="/matches" replace />} />
              <Route path="/likes-you" element={<Navigate to="/who-liked-you" replace />} />
              <Route path="/passport" element={<Navigate to="/passport-mode" replace />} />
              <Route path="/boosts" element={<Navigate to="/get-boosts" replace />} />
              <Route path="/super-likes" element={<Navigate to="/get-super-likes" replace />} />
              <Route path="/subscription-comparison" element={<Navigate to="/compare-plans" replace />} />
              <Route path="/login" element={<Navigate to="/auth" replace />} />
              <Route path="/forgot-password" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/cuban-signup" element={<CubanSignup />} />
              {/* Takatak Auth (Google, email code, SMS code) lives on /auth; old entry points redirect. */}
              <Route path="/phone" element={<Navigate to="/auth?method=phone" replace />} />
              <Route path="/verify" element={<Navigate to="/auth" replace />} />
              <Route path="/house-rules" element={<HouseRules />} />
              <Route path="/profile-setup" element={<ProtectedRoute requireCompleteProfile={false}><ProfileSetup /></ProtectedRoute>} />
              <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
              <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
              <Route path="/likes" element={<ProtectedRoute><Likes /></ProtectedRoute>} />
              <Route path="/matches" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/chat/:matchId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
              <Route path="/edit-bio" element={<ProtectedRoute><EditBio /></ProtectedRoute>} />
              <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
              <Route path="/get-super-likes" element={<ProtectedRoute><GetSuperLikes /></ProtectedRoute>} />
              <Route path="/get-boosts" element={<ProtectedRoute><GetBoosts /></ProtectedRoute>} />
              <Route path="/my-subscription" element={<ProtectedRoute><MySubscription /></ProtectedRoute>} />
              <Route path="/safety" element={<Safety />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/community-stories" element={<LoveStories />} />
              <Route path="/love-stories" element={<Navigate to="/community-stories" replace />} />
              <Route path="/about" element={<About />} />
              <Route path="/news" element={<News />} />
              <Route path="/matches-list" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
              <Route path="/interests" element={<Interests />} />
              <Route path="/block-contacts" element={<BlockContacts />} />
              <Route path="/dark-mode" element={<DarkMode />} />
              <Route path="/autoplay-videos" element={<AutoplayVideos />} />
              <Route path="/top-picks" element={<ProtectedRoute><TopPicks /></ProtectedRoute>} />
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
              <Route path="/web-profile/:userId" element={<WebProfile />} />
              <Route path="/web-profile" element={<WebProfile />} />
              <Route path="/delete-account" element={<DeleteAccount />} />
              <Route path="/licenses" element={<Licenses />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/ticket-tracking" element={<TicketTracking />} />
              <Route path="/admin/tickets" element={<AdminRoute><AdminTickets /></AdminRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminDashboardFull /></AdminRoute>} />
              <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
              <Route path="/admin/email-templates" element={<AdminRoute><AdminEmailTemplates /></AdminRoute>} />
              <Route path="/admin/verifications" element={<AdminRoute><AdminVerifications /></AdminRoute>} />
              <Route path="/admin/agent" element={<AdminRoute allowModerator><AgentDashboard /></AdminRoute>} />
              <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
              <Route path="/admin/knowledge-base" element={<AdminRoute><AdminKnowledgeBase /></AdminRoute>} />
              <Route path="/admin/moderation" element={<AdminRoute><AdminModeration /></AdminRoute>} />
              <Route path="/knowledge-base" element={<KnowledgeBase />} />
              <Route path="/knowledge-base/:articleId" element={<KnowledgeBase />} />
              <Route path="/donate/:recipientId?" element={<CubanDonations />} />
              <Route path="/compare-plans" element={<ProtectedRoute><SubscriptionComparison /></ProtectedRoute>} />
              <Route path="/tourist-signup" element={<TouristSignup />} />
              <Route path="/consumer-health-privacy" element={<ConsumerHealthPrivacy />} />
              <Route path="/who-liked-you" element={<ProtectedRoute><WhoLikedYou /></ProtectedRoute>} />
              <Route path="/passport-mode" element={<ProtectedRoute><PassportMode /></ProtectedRoute>} />
              <Route path="/photo-verification" element={<PhotoVerification />} />
              <Route path="/double-hangout" element={<DoubleDate />} />
              <Route path="/double-date" element={<Navigate to="/double-hangout" replace />} />
              <Route path="/qa-events" element={<QAEvents />} />
              <Route path="/introductions" element={<Matchmaker />} />
              <Route path="/matchmaker" element={<Navigate to="/introductions" replace />} />
              <Route path="/loyalty-rewards" element={<LoyaltyRewards />} />
              <Route path="/cuban-rewards" element={<CubanRewards />} />
              <Route path="/cuban-cashout" element={<CubanCashout />} />
              <Route path="/my-stars" element={<MyStars />} />
              <Route path="/block-report/:userId" element={<BlockReportFlow />} />
              <Route path="/reset-password" element={<Navigate to="/auth" replace />} />
              <Route path="/update-password" element={<Navigate to="/auth" replace />} />
              <Route path="/video-call/:matchId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
              <Route path="/regulations" element={<DatingRegulations />} />
              <Route path="/dating-regulations" element={<Navigate to="/regulations" replace />} />
              <Route path="/buy-credits" element={<ProtectedRoute><BuyCredits /></ProtectedRoute>} />
              <Route path="/buy-minutes" element={<ProtectedRoute><BuyMinutes /></ProtectedRoute>} />
              <Route path="/group-chat/:groupId" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
              <Route path="/explore/:category" element={<ProtectedRoute><CategorySwipe /></ProtectedRoute>} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/staff-login" element={<ModeratorLogin />} />
              <Route path="/support" element={<SupportPortal />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/agent-dashboard" element={<AdminRoute allowModerator><AgentDashboard /></AdminRoute>} />
              <Route path="/signup" element={<Navigate to="/auth?mode=signup" replace />} />
              <Route path="/redeem-code" element={<RedeemCode />} />
              <Route path="/admin/users" element={<AdminRoute><AdminUserManagement /></AdminRoute>} />
              <Route path="/admin/payment-tests" element={<AdminRoute><AdminPaymentTests /></AdminRoute>} />
              <Route path="/phone-line" element={<ProtectedRoute><PhoneLine /></ProtectedRoute>} />
              <Route path="/phone-line/setup" element={<ProtectedRoute><PhoneLineSetup /></ProtectedRoute>} />
              <Route path="/phone-line/browse" element={<ProtectedRoute><PhoneLineBrowse /></ProtectedRoute>} />
              <Route path="/phone-line/inbox" element={<ProtectedRoute><PhoneLineInbox /></ProtectedRoute>} />
              <Route path="/phone-line/call/:callSessionId" element={<ProtectedRoute><PhoneLineCall /></ProtectedRoute>} />
              <Route path="/admin/call-tests" element={<AdminRoute><AdminCallTests /></AdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </RouteErrorBoundary>
            <AIChatWidget />
            <PushNotificationPrompt />
            <IncomingCallNotification />
            <ConsentBanner />
            </StreakProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
