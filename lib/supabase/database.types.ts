export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      availability_blocks: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          reason: string | null;
          room_type_id: string;
          start_date: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          reason?: string | null;
          room_type_id: string;
          start_date: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          reason?: string | null;
          room_type_id?: string;
          start_date?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_blocks_room_type_id_tenant_id_fkey";
            columns: ["room_type_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "room_types";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "availability_blocks_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "availability_blocks_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_config: {
        Row: {
          enforcement_mode: string;
          grace_days: number;
          id: boolean;
          require_activation: boolean;
          updated_at: string;
        };
        Insert: {
          enforcement_mode?: string;
          grace_days?: number;
          id?: boolean;
          require_activation?: boolean;
          updated_at?: string;
        };
        Update: {
          enforcement_mode?: string;
          grace_days?: number;
          id?: boolean;
          require_activation?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          cancellation_reason: string | null;
          check_in: string;
          check_out: string;
          created_at: string;
          deposit_amount: number | null;
          gateway_checkout_url: string | null;
          guest_email: string | null;
          guest_name: string;
          guest_phone: string | null;
          hold_expires_at: string | null;
          id: string;
          num_guests: number;
          proof_url: string | null;
          property_id: string;
          reminder_sent_at: string | null;
          room_type_id: string;
          source: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          total_amount: number | null;
        };
        Insert: {
          cancellation_reason?: string | null;
          check_in: string;
          check_out: string;
          created_at?: string;
          deposit_amount?: number | null;
          gateway_checkout_url?: string | null;
          guest_email?: string | null;
          guest_name: string;
          guest_phone?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          num_guests: number;
          proof_url?: string | null;
          property_id: string;
          reminder_sent_at?: string | null;
          room_type_id: string;
          source?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          total_amount?: number | null;
        };
        Update: {
          cancellation_reason?: string | null;
          check_in?: string;
          check_out?: string;
          created_at?: string;
          deposit_amount?: number | null;
          gateway_checkout_url?: string | null;
          guest_email?: string | null;
          guest_name?: string;
          guest_phone?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          num_guests?: number;
          proof_url?: string | null;
          property_id?: string;
          reminder_sent_at?: string | null;
          room_type_id?: string;
          source?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          tenant_id?: string;
          total_amount?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_tenant_id_fkey";
            columns: ["property_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "bookings_room_type_id_tenant_id_fkey";
            columns: ["room_type_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "room_types";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          booking_id: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          proof_url: string | null;
          provider: string;
          provider_ref: string | null;
          raw_payload: Json | null;
          status: string;
          tenant_id: string;
        };
        Insert: {
          amount: number;
          booking_id: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          proof_url?: string | null;
          provider: string;
          provider_ref?: string | null;
          raw_payload?: Json | null;
          status: string;
          tenant_id: string;
        };
        Update: {
          amount?: number;
          booking_id?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          proof_url?: string | null;
          provider?: string;
          provider_ref?: string | null;
          raw_payload?: Json | null;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_tenant_id_fkey";
            columns: ["booking_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      properties: {
        Row: {
          about: string | null;
          address: string | null;
          amenities: Json;
          area: string | null;
          check_in_time: string;
          check_out_time: string;
          cover_image_path: string | null;
          created_at: string;
          deposit_percent: number;
          description: string | null;
          dot_accredited: boolean;
          facebook_url: string | null;
          id: string;
          instagram_url: string | null;
          min_stay_nights: number;
          name: string;
          photos: Json;
          slug: string;
          tenant_id: string;
          tiktok_url: string | null;
        };
        Insert: {
          about?: string | null;
          address?: string | null;
          amenities?: Json;
          area?: string | null;
          check_in_time?: string;
          check_out_time?: string;
          cover_image_path?: string | null;
          created_at?: string;
          deposit_percent?: number;
          description?: string | null;
          dot_accredited?: boolean;
          facebook_url?: string | null;
          id?: string;
          instagram_url?: string | null;
          min_stay_nights?: number;
          name: string;
          photos?: Json;
          slug: string;
          tenant_id: string;
          tiktok_url?: string | null;
        };
        Update: {
          about?: string | null;
          address?: string | null;
          amenities?: Json;
          area?: string | null;
          check_in_time?: string;
          check_out_time?: string;
          cover_image_path?: string | null;
          created_at?: string;
          deposit_percent?: number;
          description?: string | null;
          dot_accredited?: boolean;
          facebook_url?: string | null;
          id?: string;
          instagram_url?: string | null;
          min_stay_nights?: number;
          name?: string;
          photos?: Json;
          slug?: string;
          tenant_id?: string;
          tiktok_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "properties_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "properties_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      room_types: {
        Row: {
          base_price: number;
          capacity: number;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          photos: Json;
          property_id: string;
          quantity: number;
          tenant_id: string;
        };
        Insert: {
          base_price: number;
          capacity: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          photos?: Json;
          property_id: string;
          quantity: number;
          tenant_id: string;
        };
        Update: {
          base_price?: number;
          capacity?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          photos?: Json;
          property_id?: string;
          quantity?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_types_property_id_tenant_id_fkey";
            columns: ["property_id", "tenant_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "tenant_id"];
          },
          {
            foreignKeyName: "room_types_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "room_types_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          method: string | null;
          paid_at: string;
          paymongo_checkout_id: string;
          period_end: string;
          period_start: string;
          plan: Database["public"]["Enums"]["tenant_plan"];
          provider_ref: string | null;
          raw: Json | null;
          tenant_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          id?: string;
          method?: string | null;
          paid_at?: string;
          paymongo_checkout_id: string;
          period_end: string;
          period_start: string;
          plan: Database["public"]["Enums"]["tenant_plan"];
          provider_ref?: string | null;
          raw?: Json | null;
          tenant_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          method?: string | null;
          paid_at?: string;
          paymongo_checkout_id?: string;
          period_end?: string;
          period_start?: string;
          plan?: Database["public"]["Enums"]["tenant_plan"];
          provider_ref?: string | null;
          raw?: Json | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "subscription_payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_gateway_connections: {
        Row: {
          created_at: string;
          id: string;
          provider: string;
          sk_secret_id: string;
          status: string;
          tenant_id: string;
          updated_at: string;
          webhook_id: string | null;
          webhook_token: string;
          whsk_secret_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          provider?: string;
          sk_secret_id: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
          webhook_id?: string | null;
          webhook_token: string;
          whsk_secret_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          provider?: string;
          sk_secret_id?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
          webhook_id?: string | null;
          webhook_token?: string;
          whsk_secret_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_gateway_connections_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "tenant_gateway_connections_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_payment_methods: {
        Row: {
          account_name: string | null;
          account_number: string | null;
          bank_name: string | null;
          created_at: string;
          id: string;
          qr_path: string | null;
          sort_order: number;
          tenant_id: string;
          type: Database["public"]["Enums"]["payment_method_type"];
          updated_at: string;
        };
        Insert: {
          account_name?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          id?: string;
          qr_path?: string | null;
          sort_order?: number;
          tenant_id: string;
          type: Database["public"]["Enums"]["payment_method_type"];
          updated_at?: string;
        };
        Update: {
          account_name?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          id?: string;
          qr_path?: string | null;
          sort_order?: number;
          tenant_id?: string;
          type?: Database["public"]["Enums"]["payment_method_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_payment_methods_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "tenant_payment_methods_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string;
          gcash_changed_at: string | null;
          gcash_name: string | null;
          gcash_number: string | null;
          gcash_qr_path: string | null;
          id: string;
          is_admin: boolean;
          name: string | null;
          paid_until: string | null;
          plan: Database["public"]["Enums"]["tenant_plan"];
          subscription_status: string;
          trial_ends_at: string | null;
          user_id: string;
          verification_note: string | null;
          verification_status: Database["public"]["Enums"]["tenant_verification"];
        };
        Insert: {
          created_at?: string;
          gcash_changed_at?: string | null;
          gcash_name?: string | null;
          gcash_number?: string | null;
          gcash_qr_path?: string | null;
          id?: string;
          is_admin?: boolean;
          name?: string | null;
          paid_until?: string | null;
          plan?: Database["public"]["Enums"]["tenant_plan"];
          subscription_status?: string;
          trial_ends_at?: string | null;
          user_id: string;
          verification_note?: string | null;
          verification_status?: Database["public"]["Enums"]["tenant_verification"];
        };
        Update: {
          created_at?: string;
          gcash_changed_at?: string | null;
          gcash_name?: string | null;
          gcash_number?: string | null;
          gcash_qr_path?: string | null;
          id?: string;
          is_admin?: boolean;
          name?: string | null;
          paid_until?: string | null;
          plan?: Database["public"]["Enums"]["tenant_plan"];
          subscription_status?: string;
          trial_ends_at?: string | null;
          user_id?: string;
          verification_note?: string | null;
          verification_status?: Database["public"]["Enums"]["tenant_verification"];
        };
        Relationships: [];
      };
      verification_documents: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          storage_path: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          storage_path: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          storage_path?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verification_documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant_subscription_entitlement";
            referencedColumns: ["tenant_id"];
          },
          {
            foreignKeyName: "verification_documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      tenant_subscription_entitlement: {
        Row: {
          can_accept_bookings: boolean | null;
          counts_as_paid: boolean | null;
          enforcement_mode: string | null;
          is_lapsed: boolean | null;
          is_unactivated: boolean | null;
          tenant_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_billing_health: { Args: never; Returns: Json };
      admin_dashboard_overview: { Args: never; Returns: Json };
      admin_list_operators: {
        Args: never;
        Returns: {
          created_at: string;
          email: string;
          gcash_changed_at: string;
          name: string;
          payment_methods: Json;
          tenant_id: string;
          verification_note: string;
          verification_status: Database["public"]["Enums"]["tenant_verification"];
        }[];
      };
      admin_mark_subscription_paid: {
        Args: {
          p_paid_until: string;
          p_plan?: Database["public"]["Enums"]["tenant_plan"];
          p_tenant_id: string;
        };
        Returns: {
          created_at: string;
          gcash_changed_at: string | null;
          gcash_name: string | null;
          gcash_number: string | null;
          gcash_qr_path: string | null;
          id: string;
          is_admin: boolean;
          name: string | null;
          paid_until: string | null;
          plan: Database["public"]["Enums"]["tenant_plan"];
          subscription_status: string;
          trial_ends_at: string | null;
          user_id: string;
          verification_note: string | null;
          verification_status: Database["public"]["Enums"]["tenant_verification"];
        };
        SetofOptions: {
          from: "*";
          to: "tenants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_notification_recipients: {
        Args: never;
        Returns: {
          email: string;
        }[];
      };
      admin_platform_stats: { Args: never; Returns: Json };
      admin_preview_listing: { Args: { p_slug: string }; Returns: Json };
      admin_recent_activity: {
        Args: never;
        Returns: {
          at: string;
          kind: string;
          subtitle: string;
          title: string;
        }[];
      };
      admin_recent_bookings: {
        Args: never;
        Returns: {
          booking_id: string;
          created_at: string;
          guest_name: string;
          operator_name: string;
          status: Database["public"]["Enums"]["booking_status"];
          total_amount: number;
        }[];
      };
      confirm_booking: {
        Args: {
          p_amount?: number;
          p_booking_id: string;
          p_provider_ref?: string;
        };
        Returns: {
          cancellation_reason: string | null;
          check_in: string;
          check_out: string;
          created_at: string;
          deposit_amount: number | null;
          gateway_checkout_url: string | null;
          guest_email: string | null;
          guest_name: string;
          guest_phone: string | null;
          hold_expires_at: string | null;
          id: string;
          num_guests: number;
          proof_url: string | null;
          property_id: string;
          reminder_sent_at: string | null;
          room_type_id: string;
          source: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          total_amount: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_booking_gateway: {
        Args: {
          p_amount?: number;
          p_booking_id: string;
          p_provider: string;
          p_provider_ref?: string;
          p_raw_payload?: Json;
        };
        Returns: {
          cancellation_reason: string | null;
          check_in: string;
          check_out: string;
          created_at: string;
          deposit_amount: number | null;
          gateway_checkout_url: string | null;
          guest_email: string | null;
          guest_name: string;
          guest_phone: string | null;
          hold_expires_at: string | null;
          id: string;
          num_guests: number;
          proof_url: string | null;
          property_id: string;
          reminder_sent_at: string | null;
          room_type_id: string;
          source: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          total_amount: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_booking_hold: {
        Args: {
          p_check_in: string;
          p_check_out: string;
          p_guest_email?: string;
          p_guest_name: string;
          p_guest_phone?: string;
          p_hold_minutes?: number;
          p_num_guests: number;
          p_room_type_id: string;
        };
        Returns: {
          cancellation_reason: string | null;
          check_in: string;
          check_out: string;
          created_at: string;
          deposit_amount: number | null;
          gateway_checkout_url: string | null;
          guest_email: string | null;
          guest_name: string;
          guest_phone: string | null;
          hold_expires_at: string | null;
          id: string;
          num_guests: number;
          proof_url: string | null;
          property_id: string;
          reminder_sent_at: string | null;
          room_type_id: string;
          source: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          total_amount: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_tenant_can_accept_bookings: { Args: never; Returns: boolean };
      current_tenant_id: { Args: never; Returns: string };
      downgrade_lapsed_subscriptions: {
        Args: { p_grace_days?: number };
        Returns: number;
      };
      due_deposit_reminders: {
        Args: never;
        Returns: {
          check_in: string;
          check_out: string;
          deposit_amount: number;
          guest_email: string;
          guest_name: string;
          id: string;
          num_guests: number;
          total_amount: number;
        }[];
      };
      flag_past_due_subscriptions: { Args: never; Returns: number };
      gateway_connection_status: {
        Args: never;
        Returns: {
          connected: boolean;
          provider: string;
          status: string;
          updated_at: string;
        }[];
      };
      gateway_delete_connection: {
        Args: { p_tenant_id: string };
        Returns: string;
      };
      gateway_get_connection: {
        Args: { p_tenant_id: string };
        Returns: {
          provider: string;
          sk: string;
          status: string;
          webhook_id: string;
          webhook_token: string;
          whsk: string;
        }[];
      };
      gateway_get_connection_by_token: {
        Args: { p_token: string };
        Returns: {
          provider: string;
          sk: string;
          status: string;
          tenant_id: string;
          webhook_id: string;
          webhook_token: string;
          whsk: string;
        }[];
      };
      gateway_store_connection: {
        Args: {
          p_sk: string;
          p_tenant_id: string;
          p_webhook_id?: string;
          p_webhook_token: string;
          p_whsk: string;
        };
        Returns: {
          created_at: string;
          id: string;
          provider: string;
          sk_secret_id: string;
          status: string;
          tenant_id: string;
          updated_at: string;
          webhook_id: string | null;
          webhook_token: string;
          whsk_secret_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "tenant_gateway_connections";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_public_listing: { Args: { p_slug: string }; Returns: Json };
      is_current_user_admin: { Args: never; Returns: boolean };
      list_public_listings: { Args: never; Returns: Json };
      record_subscription_payment: {
        Args: {
          p_amount: number;
          p_checkout_id: string;
          p_currency?: string;
          p_method?: string;
          p_months?: number;
          p_plan: Database["public"]["Enums"]["tenant_plan"];
          p_provider_ref?: string;
          p_raw?: Json;
          p_tenant_id: string;
        };
        Returns: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          method: string | null;
          paid_at: string;
          paymongo_checkout_id: string;
          period_end: string;
          period_start: string;
          plan: Database["public"]["Enums"]["tenant_plan"];
          provider_ref: string | null;
          raw: Json | null;
          tenant_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "subscription_payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resubmit_verification: { Args: never; Returns: undefined };
      set_tenant_verification: {
        Args: {
          p_note?: string;
          p_status: Database["public"]["Enums"]["tenant_verification"];
          p_tenant_id: string;
        };
        Returns: undefined;
      };
      submit_proof: {
        Args: { p_booking_id: string; p_proof_url: string };
        Returns: {
          cancellation_reason: string | null;
          check_in: string;
          check_out: string;
          created_at: string;
          deposit_amount: number | null;
          gateway_checkout_url: string | null;
          guest_email: string | null;
          guest_name: string;
          guest_phone: string | null;
          hold_expires_at: string | null;
          id: string;
          num_guests: number;
          proof_url: string | null;
          property_id: string;
          reminder_sent_at: string | null;
          room_type_id: string;
          source: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          total_amount: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      booking_status:
        | "pending"
        | "held"
        | "awaiting_confirmation"
        | "confirmed"
        | "cancelled"
        | "expired"
        | "completed"
        | "no_show";
      payment_kind: "deposit" | "balance";
      payment_method_type: "gcash" | "maya" | "bank" | "grabpay";
      tenant_plan: "free" | "business" | "solo" | "pro";
      tenant_verification: "pending" | "approved" | "suspended" | "changes_requested";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: [
        "pending",
        "held",
        "awaiting_confirmation",
        "confirmed",
        "cancelled",
        "expired",
        "completed",
        "no_show",
      ],
      payment_kind: ["deposit", "balance"],
      payment_method_type: ["gcash", "maya", "bank", "grabpay"],
      tenant_plan: ["free", "business", "solo", "pro"],
      tenant_verification: ["pending", "approved", "suspended", "changes_requested"],
    },
  },
} as const;
