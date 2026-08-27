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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          settings: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          settings: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      market_candles: {
        Row: {
          bucket_start: string
          close: number
          created_at: string
          first_sample_at: string
          high: number
          is_closed: boolean
          last_sample_at: string
          low: number
          open: number
          sample_count: number
          source: string
          symbol: string
          timeframe: string
          updated_at: string
          version: string
        }
        Insert: {
          bucket_start: string
          close: number
          created_at?: string
          first_sample_at: string
          high: number
          is_closed?: boolean
          last_sample_at: string
          low: number
          open: number
          sample_count: number
          source?: string
          symbol?: string
          timeframe?: string
          updated_at?: string
          version?: string
        }
        Update: {
          bucket_start?: string
          close?: number
          created_at?: string
          first_sample_at?: string
          high?: number
          is_closed?: boolean
          last_sample_at?: string
          low?: number
          open?: number
          sample_count?: number
          source?: string
          symbol?: string
          timeframe?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      market_price_samples: {
        Row: {
          currency: string
          id: number
          ingested_at: string
          price: number
          provider_updated_at: string
          source: string
          symbol: string
          version: string
        }
        Insert: {
          currency?: string
          id?: number
          ingested_at?: string
          price: number
          provider_updated_at: string
          source?: string
          symbol?: string
          version?: string
        }
        Update: {
          currency?: string
          id?: number
          ingested_at?: string
          price?: number
          provider_updated_at?: string
          source?: string
          symbol?: string
          version?: string
        }
        Relationships: []
      }
      prediction_results: {
        Row: {
          actual: Json
          created_at: string
          device_id: string | null
          prediction_id: string
          score: Json
          user_id: string | null
        }
        Insert: {
          actual: Json
          created_at?: string
          device_id?: string | null
          prediction_id: string
          score: Json
          user_id?: string | null
        }
        Update: {
          actual?: Json
          created_at?: string
          device_id?: string | null
          prediction_id?: string
          score?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_results_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: true
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          ai_explanation: Json | null
          as_of: number
          created_at: string
          device_id: string | null
          horizon: number
          id: string
          locked: boolean
          mode: string
          price: number
          snapshot: Json
          symbol: string
          timeframe: string
          user_id: string | null
        }
        Insert: {
          ai_explanation?: Json | null
          as_of: number
          created_at?: string
          device_id?: string | null
          horizon: number
          id: string
          locked?: boolean
          mode: string
          price: number
          snapshot: Json
          symbol?: string
          timeframe?: string
          user_id?: string | null
        }
        Update: {
          ai_explanation?: Json | null
          as_of?: number
          created_at?: string
          device_id?: string | null
          horizon?: number
          id?: string
          locked?: boolean
          mode?: string
          price?: number
          snapshot?: Json
          symbol?: string
          timeframe?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ingest_gold_api_price: {
        Args: { p_ingested_at?: string; p_price: number; p_updated_at: string }
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
    Enums: {},
  },
} as const
