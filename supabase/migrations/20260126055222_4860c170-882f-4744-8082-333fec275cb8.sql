-- Insert sample forum posts if they don't exist
INSERT INTO public.forum_posts (category_id, author_name, title, content, is_pinned) 
SELECT 
  (SELECT id FROM forum_categories WHERE name = 'Dating & Relationships'),
  'María García',
  'Tips for a great first date in Havana',
  'Looking for ideas for a memorable first date in Havana? Here are some of my favorites:

1. Walk along the Malecón at sunset
2. Have coffee at a local café in Old Havana
3. Visit the beautiful Parque Central

What are your favorite date spots?',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.forum_posts WHERE title = 'Tips for a great first date in Havana');

INSERT INTO public.forum_posts (category_id, author_name, title, content, is_pinned) 
SELECT 
  (SELECT id FROM forum_categories WHERE name = 'Cuban Culture & Travel'),
  'John Smith',
  'My first trip to Cuba - Amazing experience!',
  'Just got back from my first trip to Cuba and I am completely in love with the country. The people are so warm and welcoming. The music, the food, the architecture - everything was incredible!

Any tips for my next visit?',
  false
WHERE NOT EXISTS (SELECT 1 FROM public.forum_posts WHERE title = 'My first trip to Cuba - Amazing experience!');

INSERT INTO public.forum_posts (category_id, author_name, title, content, is_pinned) 
SELECT 
  (SELECT id FROM forum_categories WHERE name = 'Events & Meetups'),
  'Carlos Rodríguez',
  'Monthly CubaDate meetup in Toronto - January 2026',
  'Hey everyone! We are organizing our monthly CubaDate community meetup in Toronto.

Date: January 30, 2026
Location: Little Havana Restaurant
Time: 7:00 PM

Come meet other members of the community! RSVP in the comments.',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.forum_posts WHERE title LIKE '%Monthly CubaDate meetup in Toronto%');

INSERT INTO public.forum_posts (category_id, author_name, title, content, is_pinned) 
SELECT 
  (SELECT id FROM forum_categories WHERE name = 'General Discussion'),
  'Ana López',
  'Learning Spanish for better connections',
  'I am a Canadian trying to learn Spanish to better communicate with Cuban matches. Any recommendations for good learning resources?

Currently using Duolingo but looking for something more conversation-focused.',
  false
WHERE NOT EXISTS (SELECT 1 FROM public.forum_posts WHERE title = 'Learning Spanish for better connections');

INSERT INTO public.forum_posts (category_id, author_name, title, content, is_pinned) 
SELECT 
  (SELECT id FROM forum_categories WHERE name = 'Success Stories'),
  'David & Yamilet',
  'We met on CubaDate and got married!',
  'Just wanted to share our success story! David from Toronto met Yamilet from Santiago de Cuba on CubaDate last year. After many video calls and two trips to Cuba, we got married in a beautiful ceremony in Havana.

Thank you CubaDate for bringing us together! ❤️',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.forum_posts WHERE title LIKE '%We met on CubaDate and got married%');

INSERT INTO public.forum_posts (category_id, author_name, title, content, is_pinned) 
SELECT 
  (SELECT id FROM forum_categories WHERE name = 'Safety & Support'),
  'CubaDate Team',
  'Important safety tips for online dating',
  'Welcome to our safety tips discussion! Here are some important reminders:

1. Never share personal financial information
2. Video chat before meeting in person
3. Always meet in public places first
4. Trust your instincts

Stay safe everyone!',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.forum_posts WHERE title = 'Important safety tips for online dating');