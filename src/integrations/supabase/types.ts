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
          distance_preference: number | null
          drinking: string | null
          education: string | null
          first_name: string
          gender: string
          id: string
          interested_in: string[] | null
          interests: string[] | null
          is_active: boolean | null
          is_cuban: boolean | null
          is_premium: boolean | null
          is_verified: boolean | null
          job_title: string | null
          last_boost_at: string | null
          latitude: number | null
          likes_remaining: number | null
          location_enabled: boolean | null
          longitude: number | null
          looking_for: string | null
          love_language: string | null
          pets: string[] | null
          privacy_accepted: boolean | null
          prompts: Json | null
          school: string | null
          sexual_orientation: string | null
          show_gender: boolean | null
          show_orientation: boolean | null
          smoking: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          super_likes_remaining: number | null
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
          distance_preference?: number | null
          drinking?: string | null
          education?: string | null
          first_name: string
          gender: string
          id?: string
          interested_in?: string[] | null
          interests?: string[] | null
          is_active?: boolean | null
          is_cuban?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_boost_at?: string | null
          latitude?: number | null
          likes_remaining?: number | null
          location_enabled?: boolean | null
          longitude?: number | null
          looking_for?: string | null
          love_language?: string | null
          pets?: string[] | null
          privacy_accepted?: boolean | null
          prompts?: Json | null
          school?: string | null
          sexual_orientation?: string | null
          show_gender?: boolean | null
          show_orientation?: boolean | null
          smoking?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          super_likes_remaining?: number | null
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
          distance_preference?: number | null
          drinking?: string | null
          education?: string | null
          first_name?: string
          gender?: string
          id?: string
          interested_in?: string[] | null
          interests?: string[] | null
          is_active?: boolean | null
          is_cuban?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_boost_at?: string | null
          latitude?: number | null
          likes_remaining?: number | null
          location_enabled?: boolean | null
          longitude?: number | null
          looking_for?: string | null
          love_language?: string | null
          pets?: string[] | null
          privacy_accepted?: boolean | null
          prompts?: Json | null
          school?: string | null
          sexual_orientation?: string | null
          show_gender?: boolean | null
          show_orientation?: boolean | null
          smoking?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          super_likes_remaining?: number | null
          updated_at?: string
          user_id?: string
          workout?: string | null
        }
        Relationships: []
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
          swiped_id: string
          swiper_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          swiped_id: string
          swiper_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
