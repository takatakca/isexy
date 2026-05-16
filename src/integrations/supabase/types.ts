export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      allowances: {
        Row: {
          created_at: string
          id: string
          monthly_boosts: number
          monthly_boosts_max: number
          monthly_reset_at: string
          profile_id: string
          updated_at: string
          weekly_first_impressions: number
          weekly_first_impressions_max: number
          weekly_reset_at: string
          weekly_super_likes: number
          weekly_super_likes_max: number
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_boosts?: number
          monthly_boosts_max?: number
          monthly_reset_at?: string
          profile_id: string
          updated_at?: string
          weekly_first_impressions?: number
          weekly_first_impressions_max?: number
          weekly_reset_at?: string
          weekly_super_likes?: number
          weekly_super_likes_max?: number
        }
        Update: {
          created_at?: string
          id?: string
          monthly_boosts?: number
          monthly_boosts_max?: number
          monthly_reset_at?: string
          profile_id?: string
          updated_at?: string
          weekly_first_impressions?: number
          weekly_first_impressions_max?: number
          weekly_reset_at?: string
          weekly_super_likes?: number
          weekly_super_likes_max?: number
        }
        Relationships: [
          {
            foreignKeyName: "allowances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boost_transactions: {
        Row: {
          action: string
          boost_type: string
          created_at: string
          id: string
          profile_id: string
          quantity: number
          stripe_session_id: string | null
        }
        Insert: {
          action: string
          boost_type: string
          created_at?: string
          id?: string
          profile_id: string
          quantity?: number
          stripe_session_id?: string | null
        }
        Update: {
          action?: string
          boost_type?: string
          created_at?: string
          id?: string
          profile_id?: string
          quantity?: number
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boost_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boost_wallets: {
        Row: {
          boosts: number
          created_at: string
          id: string
          monthly_boost_available: boolean
          monthly_boost_reset_at: string | null
          primetime_boosts: number
          profile_id: string
          super_boost_hours: number
          updated_at: string
        }
        Insert: {
          boosts?: number
          created_at?: string
          id?: string
          monthly_boost_available?: boolean
          monthly_boost_reset_at?: string | null
          primetime_boosts?: number
          profile_id: string
          super_boost_hours?: number
          updated_at?: string
        }
        Update: {
          boosts?: number
          created_at?: string
          id?: string
          monthly_boost_available?: boolean
          monthly_boost_reset_at?: string | null
          primetime_boosts?: number
          profile_id?: string
          super_boost_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boost_wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_minute_transactions: {
        Row: {
          balance_after: number
          balance_before: number
          call_session_id: string
          call_type: string
          created_at: string
          id: string
          minutes_charged: number
          profile_id: string
        }
        Insert: {
          balance_after: number
          balance_before: number
          call_session_id: string
          call_type: string
          created_at?: string
          id?: string
          minutes_charged?: number
          profile_id: string
        }
        Update: {
          balance_after?: number
          balance_before?: number
          call_session_id?: string
          call_type?: string
          created_at?: string
          id?: string
          minutes_charged?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_minute_transactions_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          answered_at: string | null
          call_type: string
          caller_profile_id: string
          created_at: string
          duration_seconds: number
          end_reason: string | null
          ended_at: string | null
          id: string
          match_id: string | null
          minutes_charged: number
          phone_line_profile_id: string | null
          phone_line_room_id: string | null
          provider: string
          provider_call_sid: string | null
          provider_child_call_sid: string | null
          provider_parent_call_sid: string | null
          receiver_profile_id: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          call_type: string
          caller_profile_id: string
          created_at?: string
          duration_seconds?: number
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          match_id?: string | null
          minutes_charged?: number
          phone_line_profile_id?: string | null
          phone_line_room_id?: string | null
          provider?: string
          provider_call_sid?: string | null
          provider_child_call_sid?: string | null
          provider_parent_call_sid?: string | null
          receiver_profile_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          call_type?: string
          caller_profile_id?: string
          created_at?: string
          duration_seconds?: number
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          match_id?: string | null
          minutes_charged?: number
          phone_line_profile_id?: string | null
          phone_line_room_id?: string | null
          provider?: string
          provider_call_sid?: string | null
          provider_child_call_sid?: string | null
          provider_parent_call_sid?: string | null
          receiver_profile_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          plan_months: number
          profile_id: string
          starts_at: string
          status: string
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          plan_months?: number
          profile_id: string
          starts_at?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          plan_months?: number
          profile_id?: string
          starts_at?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          created_at: string
          id: string
          session_id: string
          status: string
          transferred_to: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          status?: string
          transferred_to?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          status?: string
          transferred_to?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversations_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_violations: {
        Row: {
          action_taken: string | null
          created_at: string
          detected_content: string
          id: string
          message_id: string | null
          profile_id: string
          violation_type: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          detected_content: string
          id?: string
          message_id?: string | null
          profile_id: string
          violation_type: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          detected_content?: string
          id?: string
          message_id?: string | null
          profile_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_violations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_violations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_unlocks: {
        Row: {
          created_at: string
          credits_spent: number
          id: string
          match_id: string
          unlock_type: string
          unlocked_by: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number
          id?: string
          match_id: string
          unlock_type?: string
          unlocked_by: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          id?: string
          match_id?: string
          unlock_type?: string
          unlocked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_unlocks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_unlocks_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_codes: {
        Row: {
          code: string
          code_type: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_percent: number | null
          duration_days: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          starts_at: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          code_type: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_percent?: number | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          starts_at?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          code_type?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_percent?: number | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          starts_at?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          applied_benefit: string | null
          coupon_id: string
          expires_at: string | null
          id: string
          profile_id: string
          redeemed_at: string | null
        }
        Insert: {
          applied_benefit?: string | null
          coupon_id: string
          expires_at?: string | null
          id?: string
          profile_id: string
          redeemed_at?: string | null
        }
        Update: {
          applied_benefit?: string | null
          coupon_id?: string
          expires_at?: string | null
          id?: string
          profile_id?: string
          redeemed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          profile_id: string
          stripe_session_id: string | null
          type: string
          video_call_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          profile_id: string
          stripe_session_id?: string | null
          type: string
          video_call_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          profile_id?: string
          stripe_session_id?: string | null
          type?: string
          video_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuban_points: {
        Row: {
          created_at: string
          id: string
          lifetime_points: number
          points: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lifetime_points?: number
          points?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lifetime_points?: number
          points?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuban_points_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuban_points_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          profile_id: string
          reference_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          profile_id: string
          reference_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          profile_id?: string
          reference_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuban_points_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuban_verifications: {
        Row: {
          audio_url: string | null
          audio_verified: boolean
          carnet_back_url: string | null
          carnet_front_url: string | null
          carnet_id: string
          carnet_verified: boolean
          created_at: string
          id: string
          profile_id: string
          rejection_reason: string | null
          submitted_at: string
          updated_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          video_url: string | null
          video_verified: boolean
          whatsapp_number: string
          whatsapp_verified: boolean
        }
        Insert: {
          audio_url?: string | null
          audio_verified?: boolean
          carnet_back_url?: string | null
          carnet_front_url?: string | null
          carnet_id: string
          carnet_verified?: boolean
          created_at?: string
          id?: string
          profile_id: string
          rejection_reason?: string | null
          submitted_at?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          video_url?: string | null
          video_verified?: boolean
          whatsapp_number: string
          whatsapp_verified?: boolean
        }
        Update: {
          audio_url?: string | null
          audio_verified?: boolean
          carnet_back_url?: string | null
          carnet_front_url?: string | null
          carnet_id?: string
          carnet_verified?: boolean
          created_at?: string
          id?: string
          profile_id?: string
          rejection_reason?: string | null
          submitted_at?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          video_url?: string | null
          video_verified?: boolean
          whatsapp_number?: string
          whatsapp_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cuban_verifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount_usd: number
          completed_at: string | null
          created_at: string
          donation_type: string
          donor_profile_id: string | null
          id: string
          phone_number: string | null
          recipient_name: string | null
          recipient_profile_id: string | null
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount_usd: number
          completed_at?: string | null
          created_at?: string
          donation_type: string
          donor_profile_id?: string | null
          id?: string
          phone_number?: string | null
          recipient_name?: string | null
          recipient_profile_id?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          amount_usd?: number
          completed_at?: string | null
          created_at?: string
          donation_type?: string
          donor_profile_id?: string | null
          id?: string
          phone_number?: string | null
          recipient_name?: string | null
          recipient_profile_id?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_donor_profile_id_fkey"
            columns: ["donor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      double_date_matches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          matched_at: string
          pair1_id: string
          pair2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          matched_at?: string
          pair1_id: string
          pair2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          matched_at?: string
          pair1_id?: string
          pair2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "double_date_matches_pair1_id_fkey"
            columns: ["pair1_id"]
            isOneToOne: false
            referencedRelation: "double_date_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "double_date_matches_pair2_id_fkey"
            columns: ["pair2_id"]
            isOneToOne: false
            referencedRelation: "double_date_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      double_date_pairs: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string
          status: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          status?: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          status?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "double_date_pairs_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "double_date_pairs_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      double_date_settings: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          show_double_date_profiles: boolean | null
          show_friends_on_profile: boolean | null
          show_me_on_friend_profile: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          show_double_date_profiles?: boolean | null
          show_friends_on_profile?: boolean | null
          show_me_on_friend_profile?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          show_double_date_profiles?: boolean | null
          show_friends_on_profile?: boolean | null
          show_me_on_friend_profile?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "double_date_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      double_date_swipes: {
        Row: {
          action: string
          created_at: string
          id: string
          swiped_pair_id: string
          swiper_pair_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          swiped_pair_id: string
          swiper_pair_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          swiped_pair_id?: string
          swiper_pair_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "double_date_swipes_swiped_pair_id_fkey"
            columns: ["swiped_pair_id"]
            isOneToOne: false
            referencedRelation: "double_date_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "double_date_swipes_swiper_pair_id_fkey"
            columns: ["swiper_pair_id"]
            isOneToOne: false
            referencedRelation: "double_date_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          subject: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body_html: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body_html?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      entitlements_cache: {
        Row: {
          ads_disabled: boolean
          created_at: string
          id: string
          last_synced_at: string
          monthly_boosts: number
          passport_enabled: boolean
          pre_match_message: boolean
          priority_likes: boolean
          priority_score_multiplier: number
          profile_id: string
          see_who_liked: boolean
          tier: string
          top_picks_enabled: boolean
          unlimited_likes: boolean
          unlimited_rewinds: boolean
          updated_at: string
          visibility_controls: boolean
          weekly_first_impressions: number
          weekly_super_likes: number
        }
        Insert: {
          ads_disabled?: boolean
          created_at?: string
          id?: string
          last_synced_at?: string
          monthly_boosts?: number
          passport_enabled?: boolean
          pre_match_message?: boolean
          priority_likes?: boolean
          priority_score_multiplier?: number
          profile_id: string
          see_who_liked?: boolean
          tier?: string
          top_picks_enabled?: boolean
          unlimited_likes?: boolean
          unlimited_rewinds?: boolean
          updated_at?: string
          visibility_controls?: boolean
          weekly_first_impressions?: number
          weekly_super_likes?: number
        }
        Update: {
          ads_disabled?: boolean
          created_at?: string
          id?: string
          last_synced_at?: string
          monthly_boosts?: number
          passport_enabled?: boolean
          pre_match_message?: boolean
          priority_likes?: boolean
          priority_score_multiplier?: number
          profile_id?: string
          see_who_liked?: boolean
          tier?: string
          top_picks_enabled?: boolean
          unlimited_likes?: boolean
          unlimited_rewinds?: boolean
          updated_at?: string
          visibility_controls?: boolean
          weekly_first_impressions?: number
          weekly_super_likes?: number
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_cache_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          emoji: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          author_id: string | null
          author_name: string
          category_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          reply_count: number
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          author_name: string
          category_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reply_count?: number
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          author_name?: string
          category_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reply_count?: number
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          author_id: string | null
          author_name: string
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_packages: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_usd: number
          sort_order: number
          value_description: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_usd: number
          sort_order?: number
          value_description?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_usd?: number
          sort_order?: number
          value_description?: string | null
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          amount_usd: number
          completed_at: string | null
          created_at: string
          gift_package_id: string
          id: string
          message: string | null
          receiver_profile_id: string
          sender_profile_id: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount_usd: number
          completed_at?: string | null
          created_at?: string
          gift_package_id: string
          id?: string
          message?: string | null
          receiver_profile_id: string
          sender_profile_id: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          amount_usd?: number
          completed_at?: string | null
          created_at?: string
          gift_package_id?: string
          id?: string
          message?: string | null
          receiver_profile_id?: string
          sender_profile_id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_gift_package_id_fkey"
            columns: ["gift_package_id"]
            isOneToOne: false
            referencedRelation: "gift_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_receiver_profile_id_fkey"
            columns: ["receiver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_chat_members: {
        Row: {
          group_chat_id: string
          id: string
          joined_at: string
          profile_id: string
        }
        Insert: {
          group_chat_id: string
          id?: string
          joined_at?: string
          profile_id: string
        }
        Update: {
          group_chat_id?: string
          id?: string
          joined_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chat_members_group_chat_id_fkey"
            columns: ["group_chat_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_chat_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_chats: {
        Row: {
          created_at: string
          double_date_match_id: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          double_date_match_id?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          double_date_match_id?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chats_double_date_match_id_fkey"
            columns: ["double_date_match_id"]
            isOneToOne: false
            referencedRelation: "double_date_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_chat_id: string
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_chat_id: string
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_chat_id?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_chat_id_fkey"
            columns: ["group_chat_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          helpful_count: number
          id: string
          is_published: boolean
          not_helpful_count: number
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_published?: boolean
          not_helpful_count?: number
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_published?: boolean
          not_helpful_count?: number
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      live_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string | null
          sender_type: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_type: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_type?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_chat_sessions: {
        Row: {
          agent_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
          status: string
          ticket_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          ticket_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          ticket_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          id: string
          is_active: boolean | null
          last_message_at: string | null
          matched_at: string
          profile1_id: string
          profile2_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          matched_at?: string
          profile1_id: string
          profile2_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          matched_at?: string
          profile1_id?: string
          profile2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_profile1_id_fkey"
            columns: ["profile1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_profile2_id_fkey"
            columns: ["profile2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_translations: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          source_language: string
          target_language: string
          translated_content: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          source_language: string
          target_language: string
          translated_content: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          source_language?: string
          target_language?: string
          translated_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_translations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          match_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          match_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missed_calls: {
        Row: {
          call_session_id: string | null
          caller_id: string
          created_at: string
          id: string
          match_id: string
          notified_email: boolean | null
          notified_push: boolean | null
          notified_whatsapp: boolean | null
          receiver_id: string
        }
        Insert: {
          call_session_id?: string | null
          caller_id: string
          created_at?: string
          id?: string
          match_id: string
          notified_email?: boolean | null
          notified_push?: boolean | null
          notified_whatsapp?: boolean | null
          receiver_id: string
        }
        Update: {
          call_session_id?: string | null
          caller_id?: string
          created_at?: string
          id?: string
          match_id?: string
          notified_email?: boolean | null
          notified_push?: boolean | null
          notified_whatsapp?: boolean | null
          receiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missed_calls_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "video_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_calls_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_calls_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_topups: {
        Row: {
          amount_cup: number | null
          amount_usd: number
          buyer_profile_id: string
          carrier: string
          completed_at: string | null
          id: string
          phone_number: string
          purchased_at: string
          recipient_profile_id: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount_cup?: number | null
          amount_usd: number
          buyer_profile_id: string
          carrier: string
          completed_at?: string | null
          id?: string
          phone_number: string
          purchased_at?: string
          recipient_profile_id: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          amount_cup?: number | null
          amount_usd?: number
          buyer_profile_id?: string
          carrier?: string
          completed_at?: string | null
          id?: string
          phone_number?: string
          purchased_at?: string
          recipient_profile_id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mobile_topups_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobile_topups_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          type: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          type: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          type?: string
          used_at?: string | null
        }
        Relationships: []
      }
      phone_line_inbound_call_logs: {
        Row: {
          call_sid: string | null
          call_status: string
          caller_hash: string | null
          caller_masked: string | null
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          call_sid?: string | null
          call_status?: string
          caller_hash?: string | null
          caller_masked?: string | null
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          call_sid?: string | null
          call_status?: string
          caller_hash?: string | null
          caller_masked?: string | null
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      phone_line_numbers: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          phone_number_e164: string
          phone_verified: boolean
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          phone_number_e164: string
          phone_verified?: boolean
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          phone_number_e164?: string
          phone_verified?: boolean
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_line_numbers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_line_profiles: {
        Row: {
          age: number
          city: string | null
          created_at: string
          display_name: string
          gender: string | null
          headline: string | null
          id: string
          interested_in: string[] | null
          is_public: boolean
          last_active_at: string | null
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          age: number
          city?: string | null
          created_at?: string
          display_name: string
          gender?: string | null
          headline?: string | null
          id?: string
          interested_in?: string[] | null
          is_public?: boolean
          last_active_at?: string | null
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          age?: number
          city?: string | null
          created_at?: string
          display_name?: string
          gender?: string | null
          headline?: string | null
          id?: string
          interested_in?: string[] | null
          is_public?: boolean
          last_active_at?: string | null
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_line_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_line_voice_replies: {
        Row: {
          audio_url: string
          created_at: string
          duration_seconds: number
          from_profile_id: string
          greeting_id: string | null
          id: string
          is_hidden: boolean
          is_read: boolean
          moderation_status: string
          rejected_reason: string | null
          report_count: number
          to_profile_id: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          duration_seconds: number
          from_profile_id: string
          greeting_id?: string | null
          id?: string
          is_hidden?: boolean
          is_read?: boolean
          moderation_status?: string
          rejected_reason?: string | null
          report_count?: number
          to_profile_id: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          duration_seconds?: number
          from_profile_id?: string
          greeting_id?: string | null
          id?: string
          is_hidden?: boolean
          is_read?: boolean
          moderation_status?: string
          rejected_reason?: string | null
          report_count?: number
          to_profile_id?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_line_voice_replies_from_profile_id_fkey"
            columns: ["from_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_line_voice_replies_greeting_id_fkey"
            columns: ["greeting_id"]
            isOneToOne: false
            referencedRelation: "voice_greetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_line_voice_replies_to_profile_id_fkey"
            columns: ["to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          position: number
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          position?: number
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          position?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_photos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_max: number | null
          age_min: number | null
          bio: string | null
          birth_date: string
          blocked_contacts: string[] | null
          boosts_remaining: number | null
          city: string | null
          communication_style: string | null
          company: string | null
          country: string
          created_at: string
          daily_swipe_count: number
          distance_preference: number | null
          drinking: string | null
          education: string | null
          first_name: string
          first_purchase_promo_used: boolean | null
          gender: string
          id: string
          interested_in: string[] | null
          interests: string[] | null
          is_active: boolean | null
          is_cuban: boolean | null
          is_premium: boolean | null
          is_verified: boolean | null
          job_title: string | null
          last_active_at: string | null
          last_boost_at: string | null
          last_swipe_reset_at: string | null
          latitude: number | null
          likes_remaining: number | null
          location_enabled: boolean | null
          longitude: number | null
          looking_for: string | null
          love_language: string | null
          pets: string[] | null
          privacy_accepted: boolean | null
          promo_expires_at: string | null
          prompts: Json | null
          referral_code: string | null
          school: string | null
          sexual_orientation: string | null
          shadow_banned: boolean | null
          shadow_banned_at: string | null
          shadow_banned_reason: string | null
          show_gender: boolean | null
          show_orientation: boolean | null
          smoking: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          super_boost_until: string | null
          super_likes_remaining: number | null
          swipe_cooldown_until: string | null
          updated_at: string
          user_id: string
          workout: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          bio?: string | null
          birth_date: string
          blocked_contacts?: string[] | null
          boosts_remaining?: number | null
          city?: string | null
          communication_style?: string | null
          company?: string | null
          country?: string
          created_at?: string
          daily_swipe_count?: number
          distance_preference?: number | null
          drinking?: string | null
          education?: string | null
          first_name: string
          first_purchase_promo_used?: boolean | null
          gender: string
          id?: string
          interested_in?: string[] | null
          interests?: string[] | null
          is_active?: boolean | null
          is_cuban?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_active_at?: string | null
          last_boost_at?: string | null
          last_swipe_reset_at?: string | null
          latitude?: number | null
          likes_remaining?: number | null
          location_enabled?: boolean | null
          longitude?: number | null
          looking_for?: string | null
          love_language?: string | null
          pets?: string[] | null
          privacy_accepted?: boolean | null
          promo_expires_at?: string | null
          prompts?: Json | null
          referral_code?: string | null
          school?: string | null
          sexual_orientation?: string | null
          shadow_banned?: boolean | null
          shadow_banned_at?: string | null
          shadow_banned_reason?: string | null
          show_gender?: boolean | null
          show_orientation?: boolean | null
          smoking?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          super_boost_until?: string | null
          super_likes_remaining?: number | null
          swipe_cooldown_until?: string | null
          updated_at?: string
          user_id: string
          workout?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          bio?: string | null
          birth_date?: string
          blocked_contacts?: string[] | null
          boosts_remaining?: number | null
          city?: string | null
          communication_style?: string | null
          company?: string | null
          country?: string
          created_at?: string
          daily_swipe_count?: number
          distance_preference?: number | null
          drinking?: string | null
          education?: string | null
          first_name?: string
          first_purchase_promo_used?: boolean | null
          gender?: string
          id?: string
          interested_in?: string[] | null
          interests?: string[] | null
          is_active?: boolean | null
          is_cuban?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_active_at?: string | null
          last_boost_at?: string | null
          last_swipe_reset_at?: string | null
          latitude?: number | null
          likes_remaining?: number | null
          location_enabled?: boolean | null
          longitude?: number | null
          looking_for?: string | null
          love_language?: string | null
          pets?: string[] | null
          privacy_accepted?: boolean | null
          promo_expires_at?: string | null
          prompts?: Json | null
          referral_code?: string | null
          school?: string | null
          sexual_orientation?: string | null
          shadow_banned?: boolean | null
          shadow_banned_at?: string | null
          shadow_banned_reason?: string | null
          show_gender?: boolean | null
          show_orientation?: boolean | null
          smoking?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          super_boost_until?: string | null
          super_likes_remaining?: number | null
          swipe_cooldown_until?: string | null
          updated_at?: string
          user_id?: string
          workout?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          discount_percent: number
          eligible: boolean
          id: string
          offer_expires_at: string
          offer_price: number
          offer_start_at: string
          profile_id: string
          promo_type: string
          redeemed_at: string | null
          renewal_price: number
          stripe_session_id: string | null
          tier: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          eligible?: boolean
          id?: string
          offer_expires_at: string
          offer_price: number
          offer_start_at?: string
          profile_id: string
          promo_type?: string
          redeemed_at?: string | null
          renewal_price: number
          stripe_session_id?: string | null
          tier: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          eligible?: boolean
          id?: string
          offer_expires_at?: string
          offer_price?: number
          offer_start_at?: string
          profile_id?: string
          promo_type?: string
          redeemed_at?: string | null
          renewal_price?: number
          stripe_session_id?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_credits: number | null
          completed_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          bonus_credits?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          bonus_credits?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_calls: {
        Row: {
          created_at: string
          id: string
          match_id: string
          recipient_id: string
          reminder_sent: boolean | null
          scheduled_at: string
          scheduler_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          recipient_id: string
          reminder_sent?: boolean | null
          scheduled_at: string
          scheduler_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          recipient_id?: string
          reminder_sent?: boolean | null
          scheduled_at?: string
          scheduler_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_calls_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_calls_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_calls_scheduler_id_fkey"
            columns: ["scheduler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      star_cashout_requests: {
        Row: {
          admin_notes: string | null
          cashout_details: Json
          cashout_method: string
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          profile_id: string
          stars_amount: number
          status: string
          usd_amount: number
        }
        Insert: {
          admin_notes?: string | null
          cashout_details: Json
          cashout_method: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          profile_id: string
          stars_amount: number
          status?: string
          usd_amount: number
        }
        Update: {
          admin_notes?: string | null
          cashout_details?: Json
          cashout_method?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          profile_id?: string
          stars_amount?: number
          status?: string
          usd_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "star_cashout_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      star_transactions: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_profile_id: string
          sender_profile_id: string
          stars_amount: number
          status: string
          stripe_session_id: string | null
          transaction_type: string
          usd_value: number
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_profile_id: string
          sender_profile_id: string
          stars_amount: number
          status?: string
          stripe_session_id?: string | null
          transaction_type: string
          usd_value: number
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_profile_id?: string
          sender_profile_id?: string
          stars_amount?: number
          status?: string
          stripe_session_id?: string | null
          transaction_type?: string
          usd_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "star_transactions_receiver_profile_id_fkey"
            columns: ["receiver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "star_transactions_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_badges: {
        Row: {
          badge_type: string
          earned_at: string
          id: string
          profile_id: string
          streak_count: number
        }
        Insert: {
          badge_type: string
          earned_at?: string
          id?: string
          profile_id: string
          streak_count?: number
        }
        Update: {
          badge_type?: string
          earned_at?: string
          id?: string
          profile_id?: string
          streak_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "streak_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          processed_at: string | null
          processing_status: string
          stripe_event_id: string
          stripe_session_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          processed_at?: string | null
          processing_status?: string
          stripe_event_id: string
          stripe_session_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          processing_status?: string
          stripe_event_id?: string
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          profile_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          profile_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          profile_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          attachments: string[] | null
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          priority: string
          responded_at: string | null
          response: string | null
          status: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          attachments?: string[] | null
          category: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          priority?: string
          responded_at?: string | null
          response?: string | null
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          attachments?: string[] | null
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          priority?: string
          responded_at?: string | null
          response?: string | null
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      swipes: {
        Row: {
          action: string
          created_at: string
          id: string
          message: string | null
          swiped_id: string
          swiper_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          message?: string | null
          swiped_id: string
          swiper_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          message?: string | null
          swiped_id?: string
          swiper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_swiped_id_fkey"
            columns: ["swiped_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipes_swiper_id_fkey"
            columns: ["swiper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          created_at: string
          credits: number
          id: string
          last_purchase_at: string | null
          lifetime_credits: number
          phone_minutes: number
          profile_id: string
          updated_at: string
          video_minutes: number
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          last_purchase_at?: string | null
          lifetime_credits?: number
          phone_minutes?: number
          profile_id: string
          updated_at?: string
          video_minutes?: number
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          last_purchase_at?: string | null
          lifetime_credits?: number
          phone_minutes?: number
          profile_id?: string
          updated_at?: string
          video_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          auto_translate: boolean
          created_at: string
          id: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_translate?: boolean
          created_at?: string
          id?: string
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_translate?: boolean
          created_at?: string
          id?: string
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stars: {
        Row: {
          created_at: string
          id: string
          lifetime_stars_received: number
          lifetime_stars_sent: number
          profile_id: string
          stars_balance: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lifetime_stars_received?: number
          lifetime_stars_sent?: number
          profile_id: string
          stars_balance?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lifetime_stars_received?: number
          lifetime_stars_sent?: number
          profile_id?: string
          stars_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stars_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warnings: {
        Row: {
          ban_until: string | null
          created_at: string
          evidence: string | null
          id: string
          is_permanent_ban: boolean | null
          issued_by: string | null
          profile_id: string
          warning_level: number
          warning_type: string
        }
        Insert: {
          ban_until?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          is_permanent_ban?: boolean | null
          issued_by?: string | null
          profile_id: string
          warning_level?: number
          warning_type: string
        }
        Update: {
          ban_until?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          is_permanent_ban?: boolean | null
          issued_by?: string | null
          profile_id?: string
          warning_level?: number
          warning_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warnings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warnings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_call_sessions: {
        Row: {
          caller_id: string
          created_at: string
          credits_used: number | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          match_id: string
          receiver_id: string
          started_at: string
          status: string
        }
        Insert: {
          caller_id: string
          created_at?: string
          credits_used?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          match_id: string
          receiver_id: string
          started_at?: string
          status?: string
        }
        Update: {
          caller_id?: string
          created_at?: string
          credits_used?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          match_id?: string
          receiver_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_call_sessions_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_sessions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_sessions_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_greetings: {
        Row: {
          audio_url: string
          created_at: string
          duration_seconds: number
          id: string
          is_active: boolean
          is_hidden: boolean
          moderation_status: string
          phone_line_profile_id: string
          profile_id: string
          rejected_reason: string | null
          report_count: number
          transcript: string | null
          updated_at: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          duration_seconds: number
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          moderation_status?: string
          phone_line_profile_id: string
          profile_id: string
          rejected_reason?: string | null
          report_count?: number
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          moderation_status?: string
          phone_line_profile_id?: string
          profile_id?: string
          rejected_reason?: string | null
          report_count?: number
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_greetings_phone_line_profile_id_fkey"
            columns: ["phone_line_profile_id"]
            isOneToOne: false
            referencedRelation: "phone_line_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_greetings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_referral_code: { Args: { p_friend_code: string }; Returns: Json }
      award_streak_badge: {
        Args: { p_badge_type: string; p_streak_count: number }
        Returns: Json
      }
      calculate_profile_score: {
        Args: { p_profile_id: string }
        Returns: number
      }
      charge_call_session_minute: {
        Args: { p_call_session_id: string }
        Returns: Json
      }
      check_promo_eligibility: {
        Args: { p_profile_id: string; p_tier: string }
        Returns: Json
      }
      check_swipe_rate_limit: { Args: { p_profile_id: string }; Returns: Json }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      deduct_call_minute: {
        Args: { p_call_type: string; p_profile_id: string }
        Returns: Json
      }
      deduct_video_credit: { Args: never; Returns: Json }
      end_call_session: {
        Args: { p_call_session_id: string; p_end_reason?: string }
        Returns: Json
      }
      ensure_user_credits: { Args: never; Returns: Json }
      generate_referral_code: { Args: never; Returns: string }
      get_admin_users: {
        Args: never
        Returns: {
          first_name: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_my_phone_line_number: {
        Args: { p_phone_e164: string }
        Returns: Json
      }
      mark_voice_reply_read: { Args: { p_reply_id: string }; Returns: Json }
      perform_like: {
        Args: { p_action: string; p_swiped_id: string; p_swiper_id: string }
        Returns: Json
      }
      redeem_coupon: {
        Args: { p_code: string; p_profile_id: string }
        Returns: Json
      }
      reset_monthly_allowances: { Args: never; Returns: number }
      reset_weekly_allowances: { Args: never; Returns: number }
      start_phone_line_call_session: {
        Args: { p_call_type?: string; p_target_profile_id: string }
        Returns: Json
      }
      sync_entitlements: { Args: { p_profile_id: string }; Returns: Json }
      unlock_conversation: {
        Args: {
          p_match_id: string
          p_profile_id: string
          p_unlock_type?: string
        }
        Returns: Json
      }
      use_boost: {
        Args: { p_boost_type: string; p_profile_id: string }
        Returns: Json
      }
      verify_otp: {
        Args: { p_code: string; p_email: string; p_type: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
