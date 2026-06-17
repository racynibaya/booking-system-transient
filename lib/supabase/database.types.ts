// Generated from the Supabase schema (project dmnjmzntkzexnanwctnr) — do not edit by hand.
// Regenerate after any migration with the Supabase MCP `generate_typescript_types`,
// or `npx supabase gen types typescript --local` once the CLI is logged in.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
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
          check_in: string;
          check_out: string;
          created_at: string;
          deposit_amount: number | null;
          guest_email: string | null;
          guest_name: string;
          guest_phone: string | null;
          hold_expires_at: string | null;
          id: string;
          num_guests: number;
          property_id: string;
          room_type_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          total_amount: number | null;
        };
        Insert: {
          check_in: string;
          check_out: string;
          created_at?: string;
          deposit_amount?: number | null;
          guest_email?: string | null;
          guest_name: string;
          guest_phone?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          num_guests: number;
          property_id: string;
          room_type_id: string;
          status?: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          total_amount?: number | null;
        };
        Update: {
          check_in?: string;
          check_out?: string;
          created_at?: string;
          deposit_amount?: number | null;
          guest_email?: string | null;
          guest_name?: string;
          guest_phone?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          num_guests?: number;
          property_id?: string;
          room_type_id?: string;
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
      properties: {
        Row: {
          address: string | null;
          amenities: Json;
          area: string | null;
          cover_image_path: string | null;
          created_at: string;
          description: string | null;
          dot_accredited: boolean;
          id: string;
          name: string;
          photos: Json;
          slug: string;
          tenant_id: string;
        };
        Insert: {
          address?: string | null;
          amenities?: Json;
          area?: string | null;
          cover_image_path?: string | null;
          created_at?: string;
          description?: string | null;
          dot_accredited?: boolean;
          id?: string;
          name: string;
          photos?: Json;
          slug: string;
          tenant_id: string;
        };
        Update: {
          address?: string | null;
          amenities?: Json;
          area?: string | null;
          cover_image_path?: string | null;
          created_at?: string;
          description?: string | null;
          dot_accredited?: boolean;
          id?: string;
          name?: string;
          photos?: Json;
          slug?: string;
          tenant_id?: string;
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
      tenants: {
        Row: {
          created_at: string;
          id: string;
          name: string | null;
          subscription_status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name?: string | null;
          subscription_status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string | null;
          subscription_status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
          check_in: string;
          check_out: string;
          created_at: string;
          deposit_amount: number | null;
          guest_email: string | null;
          guest_name: string;
          guest_phone: string | null;
          hold_expires_at: string | null;
          id: string;
          num_guests: number;
          property_id: string;
          room_type_id: string;
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
      current_tenant_id: { Args: never; Returns: string };
      get_public_listing: { Args: { p_slug: string }; Returns: Json };
    };
    Enums: {
      booking_status:
        | "pending"
        | "held"
        | "confirmed"
        | "cancelled"
        | "expired"
        | "completed"
        | "no_show";
      payment_kind: "deposit" | "balance";
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
  public: {
    Enums: {
      booking_status: [
        "pending",
        "held",
        "confirmed",
        "cancelled",
        "expired",
        "completed",
        "no_show",
      ],
      payment_kind: ["deposit", "balance"],
    },
  },
} as const;
