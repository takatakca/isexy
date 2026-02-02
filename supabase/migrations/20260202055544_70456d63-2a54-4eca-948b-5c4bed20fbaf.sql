-- Stars balance table for Cuban users
CREATE TABLE public.user_stars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_stars_received INTEGER NOT NULL DEFAULT 0,
  lifetime_stars_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Stars transactions log
CREATE TABLE public.star_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  receiver_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  stars_amount INTEGER NOT NULL CHECK (stars_amount > 0),
  usd_value DECIMAL(10,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('gift', 'purchase', 'cashout')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  stripe_session_id TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gift packages table
CREATE TABLE public.gift_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('phone_topup', 'food_package', 'stars', 'cash_donation')),
  price_usd DECIMAL(10,2) NOT NULL,
  value_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gift transactions
CREATE TABLE public.gift_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  receiver_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  gift_package_id UUID NOT NULL REFERENCES public.gift_packages(id),
  amount_usd DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_session_id TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Star cashout requests (for Cuban users)
CREATE TABLE public.star_cashout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  stars_amount INTEGER NOT NULL CHECK (stars_amount >= 1000),
  usd_amount DECIMAL(10,2) NOT NULL,
  cashout_method TEXT NOT NULL CHECK (cashout_method IN ('mobile_topup', 'bank_transfer', 'western_union')),
  cashout_details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.star_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.star_cashout_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_stars
CREATE POLICY "Users can view their own stars balance" ON public.user_stars
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = profile_id));

CREATE POLICY "Users can view other users' stars (limited)" ON public.user_stars
  FOR SELECT USING (true);

-- RLS Policies for star_transactions
CREATE POLICY "Users can view their own transactions" ON public.star_transactions
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = sender_profile_id)
    OR auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = receiver_profile_id)
  );

CREATE POLICY "Users can send stars" ON public.star_transactions
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = sender_profile_id)
  );

-- RLS Policies for gift_packages (public read)
CREATE POLICY "Anyone can view active gift packages" ON public.gift_packages
  FOR SELECT USING (is_active = true);

-- RLS Policies for gift_transactions
CREATE POLICY "Users can view their gift transactions" ON public.gift_transactions
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = sender_profile_id)
    OR auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = receiver_profile_id)
  );

CREATE POLICY "Users can create gift transactions" ON public.gift_transactions
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = sender_profile_id)
  );

-- RLS Policies for cashout requests
CREATE POLICY "Users can view their own cashout requests" ON public.star_cashout_requests
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = profile_id));

CREATE POLICY "Cuban users can request cashout" ON public.star_cashout_requests
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = profile_id AND is_cuban = true)
  );

-- Insert default gift packages
INSERT INTO public.gift_packages (name, description, category, price_usd, value_description, sort_order) VALUES
  ('100 Stars', 'Send 100 stars to show appreciation', 'stars', 1.40, '100 stars = $1.00 for creator', 1),
  ('500 Stars', 'Premium star package', 'stars', 6.50, '500 stars = $5.00 for creator', 2),
  ('1000 Stars', 'Super star package', 'stars', 12.00, '1000 stars = $10.00 for creator', 3),
  ('5000 Stars', 'Ultimate star package', 'stars', 55.00, '5000 stars = $50.00 for creator', 4),
  ('$5 Phone Recharge', 'Mobile phone top-up', 'phone_topup', 7.50, '500 CUP mobile credit', 5),
  ('$10 Phone Recharge', 'Mobile phone top-up', 'phone_topup', 14.00, '1000 CUP mobile credit', 6),
  ('$25 Phone Recharge', 'Large mobile top-up', 'phone_topup', 32.00, '2500 CUP mobile credit', 7),
  ('Basic Food Package', 'Essential groceries package', 'food_package', 25.00, 'Rice, beans, oil, essentials', 8),
  ('Family Food Package', 'Complete family meal package', 'food_package', 50.00, 'Full week groceries for family', 9),
  ('Premium Food Package', 'Premium groceries with extras', 'food_package', 100.00, 'Premium foods + household items', 10),
  ('$10 Cash Gift', 'Direct cash donation', 'cash_donation', 12.00, '$10 USD equivalent', 11),
  ('$25 Cash Gift', 'Direct cash donation', 'cash_donation', 28.00, '$25 USD equivalent', 12),
  ('$50 Cash Gift', 'Direct cash donation', 'cash_donation', 55.00, '$50 USD equivalent', 13);

-- Create trigger for updating timestamps
CREATE TRIGGER update_user_stars_updated_at
  BEFORE UPDATE ON public.user_stars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();