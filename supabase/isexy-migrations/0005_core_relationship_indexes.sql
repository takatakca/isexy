-- ISEXY-only indexes for foreign-key lookups on active social and support flows.
-- The existing composite indexes are preserved. All changes stay in isexy.
SET LOCAL search_path = isexy, extensions;

CREATE INDEX IF NOT EXISTS idx_isexy_blocks_blocked_id ON isexy.blocks (blocked_id);
CREATE INDEX IF NOT EXISTS idx_isexy_swipes_swiped_id ON isexy.swipes (swiped_id);
CREATE INDEX IF NOT EXISTS idx_isexy_matches_profile2_id ON isexy.matches (profile2_id);
CREATE INDEX IF NOT EXISTS idx_isexy_messages_sender_id ON isexy.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_isexy_chatbot_messages_conversation_id ON isexy.chatbot_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_isexy_group_messages_group_chat_id ON isexy.group_messages (group_chat_id);
CREATE INDEX IF NOT EXISTS idx_isexy_group_messages_sender_id ON isexy.group_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_isexy_live_chat_messages_session_id ON isexy.live_chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_isexy_support_tickets_user_id ON isexy.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_isexy_support_tickets_assigned_to ON isexy.support_tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_isexy_phone_line_voice_replies_greeting_id ON isexy.phone_line_voice_replies (greeting_id);
CREATE INDEX IF NOT EXISTS idx_isexy_message_translations_message_id ON isexy.message_translations (message_id);
