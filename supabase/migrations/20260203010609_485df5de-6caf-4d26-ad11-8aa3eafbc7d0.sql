-- Create coupon codes table for VIP access
CREATE TABLE public.coupon_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    code_type TEXT NOT NULL CHECK (code_type IN ('trial', 'permanent', 'discount', 'vip')),
    description TEXT,
    -- Benefits
    subscription_tier TEXT DEFAULT 'platinum',
    duration_days INTEGER, -- NULL for permanent
    discount_percent INTEGER,
    -- Usage limits
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    -- Validity
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create coupon redemptions table
CREATE TABLE public.coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES public.coupon_codes(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    applied_benefit TEXT,
    expires_at TIMESTAMP WITH TIME ZONE, -- When the benefit expires
    UNIQUE(coupon_id, profile_id) -- Each user can only redeem a code once
);

-- Enable RLS
ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for coupon_codes
CREATE POLICY "Admins can manage coupon codes"
ON public.coupon_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view active coupon codes"
ON public.coupon_codes
FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS policies for coupon_redemptions
CREATE POLICY "Users can view their own redemptions"
ON public.coupon_redemptions
FOR SELECT
TO authenticated
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can redeem coupons"
ON public.coupon_redemptions
FOR INSERT
TO authenticated
WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all redemptions"
ON public.coupon_redemptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Function to redeem a coupon code
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code TEXT, p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coupon coupon_codes%ROWTYPE;
    v_existing_redemption UUID;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Find the coupon
    SELECT * INTO v_coupon
    FROM coupon_codes
    WHERE code = UPPER(p_code)
      AND is_active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (expires_at IS NULL OR expires_at > now());
    
    IF v_coupon.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired coupon code');
    END IF;
    
    -- Check max uses
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'This coupon has reached its maximum uses');
    END IF;
    
    -- Check if already redeemed
    SELECT id INTO v_existing_redemption
    FROM coupon_redemptions
    WHERE coupon_id = v_coupon.id AND profile_id = p_profile_id;
    
    IF v_existing_redemption IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this coupon');
    END IF;
    
    -- Calculate expiration
    IF v_coupon.duration_days IS NOT NULL THEN
        v_expires_at := now() + (v_coupon.duration_days || ' days')::INTERVAL;
    ELSE
        v_expires_at := NULL; -- Permanent
    END IF;
    
    -- Create redemption
    INSERT INTO coupon_redemptions (coupon_id, profile_id, applied_benefit, expires_at)
    VALUES (v_coupon.id, p_profile_id, v_coupon.code_type || ':' || COALESCE(v_coupon.subscription_tier, 'premium'), v_expires_at);
    
    -- Increment usage count
    UPDATE coupon_codes SET current_uses = current_uses + 1, updated_at = now()
    WHERE id = v_coupon.id;
    
    -- Apply the benefit to the profile
    IF v_coupon.code_type IN ('permanent', 'vip', 'trial') THEN
        UPDATE profiles SET
            is_premium = true,
            subscription_tier = COALESCE(v_coupon.subscription_tier, 'platinum'),
            subscription_expires_at = v_expires_at,
            updated_at = now()
        WHERE id = p_profile_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'code_type', v_coupon.code_type,
        'subscription_tier', v_coupon.subscription_tier,
        'expires_at', v_expires_at,
        'description', v_coupon.description
    );
END;
$$;

-- Insert some default VIP codes (admin can add more)
INSERT INTO coupon_codes (code, code_type, description, subscription_tier, duration_days) VALUES
('CUBADATE2024', 'trial', '7-day free trial of Platinum', 'platinum', 7),
('VIP100', 'permanent', 'Permanent VIP access', 'platinum', NULL),
('PREMIUM30', 'trial', '30-day Premium trial', 'gold', 30);

-- Create updated_at trigger
CREATE TRIGGER update_coupon_codes_updated_at
    BEFORE UPDATE ON public.coupon_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();