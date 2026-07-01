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
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          cancellation_reason: string | null;
          check_in: string;
          check_out: string;
          created_at: string;
          deposit_amount: number | null;
          gateway_charge_amount: number | null;
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
          terms_version: string | null;
          total_amount: number | null;
        };
        Insert: {
          cancellation_reason?: string | null;
          check_in: string;
          check_out: string;
          created_at?: string;
          deposit_amount?: number | null;
          gateway_charge_amount?: number | null;
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
          terms_version?: string | null;
          total_amount?: number | null;
        };
        Update: {
          cancellation_reason?: string | null;
          check_in?: string;
          check_out?: string;
          created_at?: string;
          deposit_amount?: number | null;
          gateway_charge_amount?: number | null;
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
          terms_version?: string | null;
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
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiry_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          sender: string;
          thread_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          sender: string;
          thread_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          sender?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "inquiry_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiry_templates: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          sort_order: number;
          tenant_id: string;
          title: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          sort_order?: number;
          tenant_id: string;
          title: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          sort_order?: number;
          tenant_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_templates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiry_threads: {
        Row: {
          awaiting_operator: boolean;
          created_at: string;
          guest_email: string;
          guest_name: string;
          guest_phone: string | null;
          id: string;
          last_message_at: string;
          property_id: string;
          tenant_id: string;
          token: string;
        };
        Insert: {
          awaiting_operator?: boolean;
          created_at?: string;
          guest_email: string;
          guest_name: string;
          guest_phone?: string | null;
          id?: string;
          last_message_at?: string;
          property_id: string;
          tenant_id: string;
          token?: string;
        };
        Update: {
          awaiting_operator?: boolean;
          created_at?: string;
          guest_email?: string;
          guest_name?: string;
          guest_phone?: string | null;
          id?: string;
          last_message_at?: string;
          property_id?: string;
          tenant_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_threads_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiry_threads_tenant_id_fkey";
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
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payout_ledger: {
        Row: {
          booking_id: string;
          clear_eta: string;
          created_at: string;
          deposit_amount: number;
          fail_reason: string | null;
          guest_service_fee: number;
          id: string;
          operator_commission: number;
          owner_payout: number;
          paymongo_fee: number;
          payout_id: string | null;
          payout_ref: string | null;
          refund_amount: number | null;
          refund_ref: string | null;
          status: Database["public"]["Enums"]["payout_ledger_status"];
          stay_value: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          clear_eta: string;
          created_at?: string;
          deposit_amount: number;
          fail_reason?: string | null;
          guest_service_fee: number;
          id?: string;
          operator_commission: number;
          owner_payout: number;
          paymongo_fee: number;
          payout_id?: string | null;
          payout_ref?: string | null;
          refund_amount?: number | null;
          refund_ref?: string | null;
          status?: Database["public"]["Enums"]["payout_ledger_status"];
          stay_value: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          clear_eta?: string;
          created_at?: string;
          deposit_amount?: number;
          fail_reason?: string | null;
          guest_service_fee?: number;
          id?: string;
          operator_commission?: number;
          owner_payout?: number;
          paymongo_fee?: number;
          payout_id?: string | null;
          payout_ref?: string | null;
          refund_amount?: number | null;
          refund_ref?: string | null;
          status?: Database["public"]["Enums"]["payout_ledger_status"];
          stay_value?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payout_ledger_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payout_ledger_tenant_id_fkey";
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
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          booking_id: string;
          comment: string | null;
          created_at: string;
          guest_email: string;
          guest_name: string;
          id: string;
          invited_at: string;
          operator_replied_at: string | null;
          operator_reply: string | null;
          property_id: string;
          rating: number | null;
          submitted_at: string | null;
          tenant_id: string;
          token: string;
        };
        Insert: {
          booking_id: string;
          comment?: string | null;
          created_at?: string;
          guest_email: string;
          guest_name: string;
          id?: string;
          invited_at?: string;
          operator_replied_at?: string | null;
          operator_reply?: string | null;
          property_id: string;
          rating?: number | null;
          submitted_at?: string | null;
          tenant_id: string;
          token?: string;
        };
        Update: {
          booking_id?: string;
          comment?: string | null;
          created_at?: string;
          guest_email?: string;
          guest_name?: string;
          id?: string;
          invited_at?: string;
          operator_replied_at?: string | null;
          operator_reply?: string | null;
          property_id?: string;
          rating?: number | null;
          submitted_at?: string | null;
          tenant_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_tenant_id_fkey";
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
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_consents: {
        Row: {
          accepted_at: string;
          context: Database["public"]["Enums"]["consent_context"];
          id: string;
          ip: string | null;
          tenant_id: string;
          terms_version: string;
          user_agent: string | null;
        };
        Insert: {
          accepted_at?: string;
          context: Database["public"]["Enums"]["consent_context"];
          id?: string;
          ip?: string | null;
          tenant_id: string;
          terms_version: string;
          user_agent?: string | null;
        };
        Update: {
          accepted_at?: string;
          context?: Database["public"]["Enums"]["consent_context"];
          id?: string;
          ip?: string | null;
          tenant_id?: string;
          terms_version?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_consents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
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
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_payout_accounts: {
        Row: {
          account_number: string;
          bank_name: string | null;
          commission_rate: number;
          created_at: string;
          id: string;
          method: Database["public"]["Enums"]["payout_method"];
          payout_bic: string | null;
          payout_name: string;
          service_fee_rate: number;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          account_number: string;
          bank_name?: string | null;
          commission_rate?: number;
          created_at?: string;
          id?: string;
          method: Database["public"]["Enums"]["payout_method"];
          payout_bic?: string | null;
          payout_name: string;
          service_fee_rate?: number;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          account_number?: string;
          bank_name?: string | null;
          commission_rate?: number;
          created_at?: string;
          id?: string;
          method?: Database["public"]["Enums"]["payout_method"];
          payout_bic?: string | null;
          payout_name?: string;
          service_fee_rate?: number;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_payout_accounts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_xendit_accounts: {
        Row: {
          account_holder_id: string | null;
          commission_rate: number;
          created_at: string;
          id: string;
          kyc_status: Database["public"]["Enums"]["xendit_account_status"];
          kyc_submitted_at: string | null;
          payout_account_name: string | null;
          payout_account_number: string | null;
          payout_channel_code: string | null;
          sub_account_id: string;
          tenant_id: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          account_holder_id?: string | null;
          commission_rate?: number;
          created_at?: string;
          id?: string;
          kyc_status?: Database["public"]["Enums"]["xendit_account_status"];
          kyc_submitted_at?: string | null;
          payout_account_name?: string | null;
          payout_account_number?: string | null;
          payout_channel_code?: string | null;
          sub_account_id: string;
          tenant_id: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          account_holder_id?: string | null;
          commission_rate?: number;
          created_at?: string;
          id?: string;
          kyc_status?: Database["public"]["Enums"]["xendit_account_status"];
          kyc_submitted_at?: string | null;
          payout_account_name?: string | null;
          payout_account_number?: string | null;
          payout_channel_code?: string | null;
          sub_account_id?: string;
          tenant_id?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_xendit_accounts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
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
          inquiry_auto_reply: string | null;
          inquiry_auto_reply_enabled: boolean;
          is_admin: boolean;
          name: string | null;
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
          inquiry_auto_reply?: string | null;
          inquiry_auto_reply_enabled?: boolean;
          is_admin?: boolean;
          name?: string | null;
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
          inquiry_auto_reply?: string | null;
          inquiry_auto_reply_enabled?: boolean;
          is_admin?: boolean;
          name?: string | null;
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
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      abort_refund: {
        Args: { p_booking_id: string; p_restore_status: string };
        Returns: number;
      };
      add_banking_days: {
        Args: { p_days: number; p_from: string };
        Returns: string;
      };
      admin_action_center: { Args: never; Returns: Json };
      admin_activity_feed: {
        Args: never;
        Returns: {
          at: string;
          kind: string;
          subtitle: string;
          title: string;
        }[];
      };
      admin_dashboard_overview: { Args: never; Returns: Json };
      admin_finance_overview: { Args: never; Returns: Json };
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
          xendit_kyc_status: Database["public"]["Enums"]["xendit_account_status"];
        }[];
      };
      admin_list_payouts: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string };
        Returns: {
          clear_eta: string;
          created_at: string;
          deposit_amount: number;
          guest_name: string;
          id: string;
          operator_commission: number;
          operator_name: string;
          owner_payout: number;
          property_name: string;
          status: Database["public"]["Enums"]["payout_ledger_status"];
          stay_value: number;
          total_count: number;
        }[];
      };
      admin_notification_recipients: {
        Args: never;
        Returns: {
          email: string;
        }[];
      };
      admin_preview_listing: { Args: { p_slug: string }; Returns: Json };
      admin_recent_payouts: {
        Args: never;
        Returns: {
          booking_id: string;
          created_at: string;
          deposit_amount: number;
          guest_name: string;
          operator_name: string;
          property_name: string;
          status: string;
        }[];
      };
      claim_due_payouts: {
        Args: never;
        Returns: {
          account_number: string;
          method: Database["public"]["Enums"]["payout_method"];
          payout_bic: string;
          payout_id: string;
          payout_name: string;
          tenant_id: string;
          total: number;
        }[];
      };
      claim_refund: {
        Args: { p_booking_id: string };
        Returns: {
          paid_amount: number;
          prior_status: string;
          provider_ref: string;
          tenant_id: string;
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
          gateway_charge_amount: number | null;
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
          terms_version: string | null;
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
          gateway_charge_amount: number | null;
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
          terms_version: string | null;
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
          gateway_charge_amount: number | null;
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
          terms_version: string | null;
          total_amount: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_tenant_id: { Args: never; Returns: string };
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
      finish_refund: {
        Args: {
          p_amount: number;
          p_booking_id: string;
          p_clawback: boolean;
          p_refund_ref: string;
        };
        Returns: number;
      };
      get_public_listing: { Args: { p_slug: string }; Returns: Json };
      get_public_reviews: { Args: { p_slug: string }; Returns: Json };
      is_current_user_admin: { Args: never; Returns: boolean };
      list_public_listings: { Args: never; Returns: Json };
      mark_payout_failed: {
        Args: { p_payout_id: string; p_reason: string };
        Returns: number;
      };
      mark_payout_paid: {
        Args: { p_payout_id: string; p_provider_ref: string };
        Returns: number;
      };
      mint_review_invites: {
        Args: never;
        Returns: {
          guest_email: string;
          guest_name: string;
          id: string;
          property_name: string;
          token: string;
        }[];
      };
      reconcile_disbursement: {
        Args: { p_payout_id: string; p_reason?: string; p_succeeded: boolean };
        Returns: number;
      };
      reply_to_review: {
        Args: { p_reply: string; p_review_id: string };
        Returns: undefined;
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
          gateway_charge_amount: number | null;
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
          terms_version: string | null;
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
      consent_context: "operator_signup" | "operator_agreement" | "operator_listing";
      payment_kind: "deposit" | "balance";
      payment_method_type: "gcash" | "maya" | "bank" | "grabpay";
      payout_ledger_status:
        | "clearing"
        | "payable"
        | "paid"
        | "failed"
        | "refunded"
        | "clawed_back"
        | "refunding";
      payout_method: "gcash" | "bank";
      tenant_verification: "pending" | "approved" | "suspended" | "changes_requested";
      xendit_account_status:
        | "INVITED"
        | "REGISTERED"
        | "AWAITING_DOCS"
        | "PENDING_VERIFICATION"
        | "LIVE"
        | "SUSPENDED";
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
      consent_context: ["operator_signup", "operator_agreement", "operator_listing"],
      payment_kind: ["deposit", "balance"],
      payment_method_type: ["gcash", "maya", "bank", "grabpay"],
      payout_ledger_status: [
        "clearing",
        "payable",
        "paid",
        "failed",
        "refunded",
        "clawed_back",
        "refunding",
      ],
      payout_method: ["gcash", "bank"],
      tenant_verification: ["pending", "approved", "suspended", "changes_requested"],
      xendit_account_status: [
        "INVITED",
        "REGISTERED",
        "AWAITING_DOCS",
        "PENDING_VERIFICATION",
        "LIVE",
        "SUSPENDED",
      ],
    },
  },
} as const;
