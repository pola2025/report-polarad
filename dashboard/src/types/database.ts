export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          client_id: string
          client_name: string
          slug: string | null
          meta_ad_account_id: string | null
          meta_access_token_id: string | null
          token_expires_at: string | null
          status: string
          is_active: boolean
          telegram_chat_id: string | null
          telegram_enabled: boolean
          service_start_date: string | null
          service_end_date: string | null
          meta_metric_type: 'lead' | 'video'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          client_name: string
          slug?: string | null
          meta_ad_account_id?: string | null
          meta_access_token_id?: string | null
          token_expires_at?: string | null
          status?: string
          is_active?: boolean
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          service_start_date?: string | null
          service_end_date?: string | null
          meta_metric_type?: 'lead' | 'video'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          client_name?: string
          slug?: string | null
          meta_ad_account_id?: string | null
          meta_access_token_id?: string | null
          token_expires_at?: string | null
          status?: string
          is_active?: boolean
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          service_start_date?: string | null
          service_end_date?: string | null
          meta_metric_type?: 'lead' | 'video'
          created_at?: string
          updated_at?: string
        }
      }
      meta_raw_data: {
        Row: {
          id: number
          client_id: string
          date: string
          ad_id: string
          ad_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          platform: string | null
          device: string | null
          impressions: number
          clicks: number
          leads: number
          spend: number
          video_views: number
          avg_watch_time: number
          currency: string
          created_at: string
        }
        Insert: {
          id?: number
          client_id: string
          date: string
          ad_id: string
          ad_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          platform?: string | null
          device?: string | null
          impressions?: number
          clicks?: number
          leads?: number
          spend?: number
          video_views?: number
          avg_watch_time?: number
          currency?: string
          created_at?: string
        }
        Update: {
          id?: number
          client_id?: string
          date?: string
          ad_id?: string
          ad_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          platform?: string | null
          device?: string | null
          impressions?: number
          clicks?: number
          leads?: number
          spend?: number
          video_views?: number
          avg_watch_time?: number
          currency?: string
          created_at?: string
        }
      }
      naver_place_data: {
        Row: {
          id: number
          client_id: string
          date: string
          keyword: string
          impressions: number
          clicks: number
          ctr: number
          avg_cpc: number
          total_cost: number
          avg_rank: number
          created_at: string
        }
        Insert: {
          id?: number
          client_id: string
          date: string
          keyword: string
          impressions?: number
          clicks?: number
          ctr?: number
          avg_cpc?: number
          total_cost?: number
          avg_rank?: number
          created_at?: string
        }
        Update: {
          id?: number
          client_id?: string
          date?: string
          keyword?: string
          impressions?: number
          clicks?: number
          ctr?: number
          avg_cpc?: number
          total_cost?: number
          avg_rank?: number
          created_at?: string
        }
      }
      keyword_stats: {
        Row: {
          id: number
          client_id: string
          year_month: string
          keyword: string
          pc_searches: number
          mobile_searches: number
          total_searches: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          client_id: string
          year_month: string
          keyword: string
          pc_searches?: number
          mobile_searches?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          client_id?: string
          year_month?: string
          keyword?: string
          pc_searches?: number
          mobile_searches?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
