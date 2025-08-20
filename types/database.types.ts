export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          booking_date: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          end_time: string
          id: string
          platform_fee: number
          provider_id: string
          provider_notes: string | null
          provider_payout: number
          service_duration: number
          service_name: string
          service_price: number
          start_time: string
          status: string
          stripe_payment_intent_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          booking_date: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          end_time: string
          id?: string
          platform_fee: number
          provider_id: string
          provider_notes?: string | null
          provider_payout: number
          service_duration: number
          service_name: string
          service_price: number
          start_time: string
          status?: string
          stripe_payment_intent_id?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          booking_date?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          end_time?: string
          id?: string
          platform_fee?: number
          provider_id?: string
          provider_notes?: string | null
          provider_payout?: number
          service_duration?: number
          service_name?: string
          service_price?: number
          start_time?: string
          status?: string
          stripe_payment_intent_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      pending_profiles: {
        Row: {
          billing_cycle_end: string | null
          billing_cycle_start: string | null
          claimed: boolean | null
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          email: string
          id: string
          membership: Database["public"]["Enums"]["membership"]
          next_credit_renewal: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan_duration: string | null
          token: string | null
          updated_at: string
          usage_credits: number | null
          used_credits: number | null
          whop_membership_id: string | null
          whop_user_id: string | null
        }
        Insert: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          claimed?: boolean | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          email: string
          id: string
          membership?: Database["public"]["Enums"]["membership"]
          next_credit_renewal?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan_duration?: string | null
          token?: string | null
          updated_at?: string
          usage_credits?: number | null
          used_credits?: number | null
          whop_membership_id?: string | null
          whop_user_id?: string | null
        }
        Update: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          claimed?: boolean | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          membership?: Database["public"]["Enums"]["membership"]
          next_credit_renewal?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan_duration?: string | null
          token?: string | null
          updated_at?: string
          usage_credits?: number | null
          used_credits?: number | null
          whop_membership_id?: string | null
          whop_user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          billing_cycle_end: string | null
          billing_cycle_start: string | null
          created_at: string
          email: string | null
          membership: Database["public"]["Enums"]["membership"]
          next_credit_renewal: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan_duration: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          usage_credits: number | null
          used_credits: number | null
          user_id: string
          whop_membership_id: string | null
          whop_user_id: string | null
        }
        Insert: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          created_at?: string
          email?: string | null
          membership?: Database["public"]["Enums"]["membership"]
          next_credit_renewal?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan_duration?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          usage_credits?: number | null
          used_credits?: number | null
          user_id: string
          whop_membership_id?: string | null
          whop_user_id?: string | null
        }
        Update: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          created_at?: string
          email?: string | null
          membership?: Database["public"]["Enums"]["membership"]
          next_credit_renewal?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan_duration?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          usage_credits?: number | null
          used_credits?: number | null
          user_id?: string
          whop_membership_id?: string | null
          whop_user_id?: string | null
        }
        Relationships: []
      }
      provider_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          provider_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          provider_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          provider_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_blocked_slots: {
        Row: {
          blocked_date: string
          created_at: string
          end_time: string | null
          id: string
          provider_id: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          end_time?: string | null
          id?: string
          provider_id: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          end_time?: string | null
          id?: string
          provider_id?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: []
      }
      provider_testimonials: {
        Row: {
          created_at: string
          customer_image: string | null
          customer_name: string
          id: string
          is_featured: boolean
          provider_id: string
          testimonial_text: string
        }
        Insert: {
          created_at?: string
          customer_image?: string | null
          customer_name: string
          id?: string
          is_featured?: boolean
          provider_id: string
          testimonial_text: string
        }
        Update: {
          created_at?: string
          customer_image?: string | null
          customer_name?: string
          id?: string
          is_featured?: boolean
          provider_id?: string
          testimonial_text?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          average_rating: number | null
          bio: string | null
          commission_rate: number
          completed_bookings: number
          cover_image_url: string | null
          created_at: string
          currency: string
          display_name: string
          gallery_images: Json | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          is_verified: boolean
          location_city: string | null
          location_country: string | null
          location_state: string | null
          profile_image_url: string | null
          services: Json | null
          slug: string
          stripe_connect_account_id: string | null
          stripe_onboarding_complete: boolean
          tagline: string | null
          total_reviews: number
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          average_rating?: number | null
          bio?: string | null
          commission_rate?: number
          completed_bookings?: number
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          display_name: string
          gallery_images?: Json | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          profile_image_url?: string | null
          services?: Json | null
          slug: string
          stripe_connect_account_id?: string | null
          stripe_onboarding_complete?: boolean
          tagline?: string | null
          total_reviews?: number
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          average_rating?: number | null
          bio?: string | null
          commission_rate?: number
          completed_bookings?: number
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          gallery_images?: Json | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          profile_image_url?: string | null
          services?: Json | null
          slug?: string
          stripe_connect_account_id?: string | null
          stripe_onboarding_complete?: boolean
          tagline?: string | null
          total_reviews?: number
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string
          flag_reason: string | null
          id: string
          is_flagged: boolean
          is_published: boolean
          is_verified_booking: boolean
          provider_id: string
          provider_responded_at: string | null
          provider_response: string | null
          rating: number
          review_text: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id: string
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          is_published?: boolean
          is_verified_booking?: boolean
          provider_id: string
          provider_responded_at?: string | null
          provider_response?: string | null
          rating: number
          review_text?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          is_published?: boolean
          is_verified_booking?: boolean
          provider_id?: string
          provider_responded_at?: string | null
          provider_response?: string | null
          rating?: number
          review_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          platform_fee: number
          processed_at: string | null
          provider_payout: number
          status: string
          stripe_charge_id: string | null
          stripe_refund_id: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          platform_fee: number
          processed_at?: string | null
          provider_payout: number
          status?: string
          stripe_charge_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          platform_fee?: number
          processed_at?: string | null
          provider_payout?: number
          status?: string
          stripe_charge_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      membership: "free" | "pro"
      payment_provider: "stripe" | "whop"
      plan_duration: "monthly" | "yearly"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      membership: ["free", "pro"],
      payment_provider: ["stripe", "whop"],
      plan_duration: ["monthly", "yearly"],
    },
  },
} as const

