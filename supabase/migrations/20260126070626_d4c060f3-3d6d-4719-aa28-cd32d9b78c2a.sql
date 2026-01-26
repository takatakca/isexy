-- Add more Cuban city-specific forum categories for Resorts, Casas, Beaches
-- Also add user aliases table for anonymity

-- Create user aliases table for forum anonymity
CREATE TABLE IF NOT EXISTS public.user_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  alias TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_aliases ENABLE ROW LEVEL SECURITY;

-- Users can view their own alias
CREATE POLICY "Users can view own alias"
ON public.user_aliases
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own alias
CREATE POLICY "Users can insert own alias"
ON public.user_aliases
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own alias
CREATE POLICY "Users can update own alias"
ON public.user_aliases
FOR UPDATE
USING (user_id = auth.uid());

-- Knowledge base articles table for customer service
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Anyone can view published articles
CREATE POLICY "Anyone can view published articles"
ON public.knowledge_base
FOR SELECT
USING (is_published = true);

-- Admins can manage knowledge base
CREATE POLICY "Admins can manage knowledge base"
ON public.knowledge_base
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Live chat sessions table for agent transfer
CREATE TABLE IF NOT EXISTS public.live_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ticket_id UUID REFERENCES public.support_tickets(id),
  agent_id UUID,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'closed', 'transferred')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own chat sessions
CREATE POLICY "Users can view own chat sessions"
ON public.live_chat_sessions
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own chat sessions
CREATE POLICY "Users can create own chat sessions"
ON public.live_chat_sessions
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admins/agents can manage chat sessions
CREATE POLICY "Admins can manage chat sessions"
ON public.live_chat_sessions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR agent_id = auth.uid());

-- Live chat messages
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.live_chat_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
  sender_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in their sessions
CREATE POLICY "Users can view messages in their sessions"
ON public.live_chat_messages
FOR SELECT
USING (
  session_id IN (
    SELECT id FROM public.live_chat_sessions 
    WHERE user_id = auth.uid() OR agent_id = auth.uid()
  )
);

-- Users can insert messages in their sessions
CREATE POLICY "Users can insert messages in their sessions"
ON public.live_chat_messages
FOR INSERT
WITH CHECK (
  session_id IN (
    SELECT id FROM public.live_chat_sessions 
    WHERE user_id = auth.uid() OR agent_id = auth.uid()
  )
);

-- Enable realtime for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;

-- Insert Cuban city forum categories
INSERT INTO public.forum_categories (name, description, emoji, color, sort_order, is_active)
VALUES 
  -- Main categories
  ('Resorts & Hotels', 'Discuss the best resorts, hotels, and all-inclusive experiences in Cuba', '🏨', 'bg-blue-500', 10, true),
  ('Private Casas (Airbnb)', 'Share experiences and recommendations for private casa particulares', '🏠', 'bg-green-500', 11, true),
  ('Beaches & Oceans', 'The best beaches, snorkeling spots, and coastal adventures', '🏖️', 'bg-cyan-500', 12, true),
  
  -- City categories
  ('La Habana', 'The vibrant capital city - restaurants, nightlife, culture, and dating spots', '🌆', 'bg-rose-500', 20, true),
  ('Santiago de Cuba', 'The cultural heart of Cuba - music, festivals, and local experiences', '🎺', 'bg-orange-500', 21, true),
  ('Varadero', 'Cuba''s famous beach resort destination - tips, spots, and meetups', '🌴', 'bg-teal-500', 22, true),
  ('Trinidad', 'UNESCO heritage city - colonial charm, salsa, and romance', '🏛️', 'bg-amber-500', 23, true),
  ('Viñales', 'Valley of mogotes - nature, tobacco farms, and adventure', '🏔️', 'bg-emerald-500', 24, true),
  ('Cienfuegos', 'The Pearl of the South - French elegance and bay views', '⛵', 'bg-indigo-500', 25, true),
  ('Camagüey', 'City of squares and tinajones - unique culture and traditions', '🏺', 'bg-purple-500', 26, true),
  ('Holguín', 'City of parks - archaeology, beaches, and local life', '🌳', 'bg-lime-500', 27, true),
  ('Santa Clara', 'Revolutionary city - Che monuments and university life', '⭐', 'bg-red-500', 28, true),
  ('Matanzas', 'City of bridges and rivers - Afro-Cuban culture', '🌉', 'bg-sky-500', 29, true),
  ('Pinar del Río', 'Tobacco country - cigars, nature, and rural Cuba', '🍃', 'bg-green-600', 30, true),
  ('Baracoa', 'Cuba''s oldest city - chocolate, coconut, and pristine beaches', '🥥', 'bg-yellow-600', 31, true),
  ('Cayo Coco', 'Island paradise - flamingos, diving, and secluded beaches', '🦩', 'bg-pink-500', 32, true),
  ('Guardalavaca', 'Holguín''s beach jewel - snorkeling and dolphin shows', '🐬', 'bg-blue-400', 33, true)
ON CONFLICT DO NOTHING;

-- Insert sample knowledge base articles
INSERT INTO public.knowledge_base (title, content, category, tags, is_published)
VALUES
  ('How to Create Your Profile', 'To create your CubaDate profile:\n\n1. Download the app or visit cubadate.com\n2. Click "Sign Up"\n3. Enter your email and password\n4. Complete your profile with photos and bio\n5. Set your preferences\n\nTips for a great profile:\n- Use recent, clear photos\n- Write an engaging bio\n- Be honest about your intentions', 'Getting Started', ARRAY['profile', 'signup', 'photos'], true),
  
  ('Understanding Cuban Verification', 'Cuban verification helps ensure authenticity of Cuban users. The process includes:\n\n1. **Carnet de Identidad**: Upload front and back photos\n2. **Video Verification**: Record a short video\n3. **Audio Verification**: Say a phrase in Spanish\n4. **WhatsApp Verification**: Confirm your Cuban number\n\nVerification typically takes 24-48 hours.', 'Verification', ARRAY['cuban', 'verification', 'carnet', 'identity'], true),
  
  ('Safety Tips for Dating', 'Stay safe while using CubaDate:\n\n1. **Never send money** to someone you haven''t met\n2. **Video chat** before meeting in person\n3. **Meet in public places** for first dates\n4. **Tell a friend** about your plans\n5. **Trust your instincts** - if something feels wrong, report it\n6. **Verify profiles** - look for the verified badge\n7. **Take your time** getting to know someone', 'Safety', ARRAY['safety', 'dating', 'tips', 'scam'], true),
  
  ('Subscription Plans Explained', 'CubaDate offers several subscription tiers:\n\n**Free Plan**\n- Limited likes per day\n- Basic matching\n- Ad-supported\n\n**Plus Plan**\n- Unlimited likes\n- See who likes you\n- No ads\n\n**Gold Plan**\n- Everything in Plus\n- Super likes\n- Profile boost\n- Message before matching\n\n**Platinum Plan**\n- Everything in Gold\n- Priority support\n- Exclusive features', 'Subscriptions', ARRAY['subscription', 'premium', 'pricing', 'features'], true),
  
  ('How Matching Works', 'CubaDate uses smart matching:\n\n1. **Swipe Right**: You like someone\n2. **Swipe Left**: Pass on a profile\n3. **Super Like**: Show extra interest\n4. **Match**: When both swipe right\n5. **Start Chatting**: After matching, send a message!\n\nTips:\n- Complete your profile for better matches\n- Update your preferences regularly\n- Be patient - great connections take time', 'Matching', ARRAY['matching', 'swipe', 'likes', 'connections'], true),
  
  ('Reporting and Blocking Users', 'To report a user:\n\n1. Open their profile\n2. Tap the "..." menu\n3. Select "Report"\n4. Choose a reason\n5. Add details (optional)\n\nTo block a user:\n\n1. Open their profile or chat\n2. Tap the "..." menu\n3. Select "Block"\n4. Confirm\n\nBlocked users cannot contact you or see your profile.', 'Safety', ARRAY['report', 'block', 'harassment', 'safety'], true),
  
  ('Message Translation Feature', 'CubaDate offers automatic message translation:\n\n1. **Enable Translation**: Go to Settings > Language\n2. **Select Your Language**: Choose your preferred language\n3. **Auto-Translate**: Messages are translated automatically\n4. **View Original**: Tap to see the original message\n\nSupported languages: English, Spanish, French, German, Portuguese, and 25+ more.', 'Features', ARRAY['translation', 'language', 'chat', 'communication'], true),
  
  ('Deleting Your Account', 'To delete your CubaDate account:\n\n1. Go to Settings\n2. Scroll to "Account"\n3. Tap "Delete Account"\n4. Enter your password\n5. Confirm deletion\n\n**Important:**\n- This action is permanent\n- Your matches and messages will be deleted\n- Your subscription will be cancelled\n- You cannot recover your account', 'Account', ARRAY['delete', 'account', 'cancel', 'remove'], true)
ON CONFLICT DO NOTHING;