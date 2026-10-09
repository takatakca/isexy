-- ISEXY is a Canadian social network for adults (18+): profiles, swipes to find
-- people to talk with and become friends, chat, phone and video calls.
-- This rewrites seeded text that still described a dating app.
--
-- Only UPDATEs, matched by the seeded title/name: no row is deleted, and rows a
-- member or admin already edited (different title) are left alone.
-- Cuba-specific seeds are ON HOLD (owner decision) and are not touched here:
-- forum_posts "Tips for a great first date in Havana", "We met on CubaDate and
-- got married!", "Learning Spanish for better connections", the Cuban city
-- forum_categories (La Habana, Trinidad, ...), "Cuban Culture & Travel",
-- knowledge_base "Understanding Cuban Verification" and gift_packages.

SET LOCAL search_path = isexy, extensions;

-- Help Center ---------------------------------------------------------------
UPDATE isexy.knowledge_base
SET title = 'How to Create Your Profile',
    content = E'To join ISEXY (18+ only):\n\n1. Go to isexy.ca and tap "Sign up"\n2. Sign in with your TAKATAK account: Google, a code sent by email, or a code sent by SMS (no password needed)\n3. Add photos and a short bio\n4. Pick your interests and what you are looking for (new friends, someone to talk to, people to do things with...)\n5. Start swiping to find people to talk with\n\nTips for a great profile:\n- Use recent, clear photos of yourself\n- Mention what you like to talk about or do\n- Be honest and respectful',
    tags = ARRAY['profile', 'signup', 'photos']
WHERE title = 'How to Create Your Profile';

UPDATE isexy.knowledge_base
SET title = 'Safety Tips for Meeting People',
    content = E'Stay safe on ISEXY:\n\n1. **Never send money** or gift cards to someone you have not met, whatever the story\n2. **Video chat** before meeting in person\n3. **Meet in public places** the first few times\n4. **Tell a friend** where you are going and with whom\n5. **Trust your instincts**: if something feels wrong, block and report\n6. **Verify profiles**: look for the verified badge\n7. **Keep personal details private** (address, workplace, banking) until you trust someone',
    tags = ARRAY['safety', 'scam', 'meeting', 'tips']
WHERE title IN ('Safety Tips for Dating', 'Safety Tips for Meeting People');

UPDATE isexy.knowledge_base
SET content = E'ISEXY offers several plans:\n\n**Free**\n- Limited likes per day\n- Matching and chat with your matches\n\n**Plus**\n- Unlimited likes\n- See who wants to talk with you\n- No ads\n\n**Gold**\n- Everything in Plus\n- Super likes\n- Profile boost\n- Message before matching\n\n**Platinum**\n- Everything in Gold\n- Priority support\n- Exclusive features\n\nPrices are in Canadian dollars. You can cancel anytime from Settings.'
WHERE title = 'Subscription Plans Explained';

UPDATE isexy.knowledge_base
SET content = E'How matching works on ISEXY:\n\n1. **Swipe right**: you would like to talk with this person\n2. **Swipe left**: pass\n3. **Super like**: show extra interest\n4. **Match**: you both swiped right\n5. **Start chatting**: say hi, then call or video chat when you are both ready\n\nTips:\n- Complete your profile and interests so people know what you like to talk about\n- Update your preferences regularly\n- Be patient: good friendships take time'
WHERE title = 'How Matching Works';

UPDATE isexy.knowledge_base
SET content = E'Lost access to your account?\n\nISEXY uses your TAKATAK account (no password):\n\n1. **Sign in with a code**: on the sign-in page choose Email or Phone and enter the code we send you\n2. **Signed up with Google**: use "Continue with Google" with the same Google account\n3. **Email not arriving**: check your spam or promotions folder\n4. **Phone number changed**: contact support with your account email\n5. **Account locked**: wait 24 hours or contact support',
    tags = ARRAY['login', 'recovery', 'account']
WHERE title = 'Account Recovery';

-- Community forum -------------------------------------------------------------
UPDATE isexy.forum_categories
SET name = 'Friendship & Social Life',
    description = 'Tips for making friends, starting conversations and meeting new people',
    emoji = '🤝'
WHERE name = 'Dating & Relationships';

UPDATE isexy.forum_categories
SET description = 'Share your stories and celebrate friendships made on ISEXY',
    emoji = '🌟'
WHERE name = 'Success Stories';

UPDATE isexy.forum_posts
SET title = 'Important safety tips for meeting people online',
    author_name = 'ISEXY Team'
WHERE title = 'Important safety tips for online dating';

UPDATE isexy.forum_posts
SET title = 'Monthly ISEXY meetup in Toronto - January 2026',
    content = replace(content, 'CubaDate', 'ISEXY')
WHERE title LIKE '%Monthly CubaDate meetup in Toronto%';

-- Support email template (old brand) ----------------------------------------
UPDATE isexy.email_templates
SET body_html = replace(body_html, 'The CubaDate Support Team', 'The ISEXY Support Team')
WHERE body_html LIKE '%The CubaDate Support Team%';
