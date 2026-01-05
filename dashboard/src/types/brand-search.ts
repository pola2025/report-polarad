/**
 * 브랜드검색 데이터 타입 정의
 */

// DB Row 타입
export interface BrandSearchDataRow {
  id: number;
  client_id: string;
  date: string;
  device: 'pc' | 'mobile';
  impressions: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

// CSV 파싱 결과
export interface BrandSearchCSVRow {
  campaign: string;
  date: string; // 원본: '2025.12.03.'
  ad_group: string; // '브랜드검색광고_PC' | '브랜드검색광고_모바일'
  impressions: number;
  clicks: number;
}

// DB 저장용 데이터
export interface BrandSearchInsertData {
  client_id: string;
  date: string; // 'YYYY-MM-DD'
  device: 'pc' | 'mobile';
  impressions: number;
  clicks: number;
}

// 일별 집계 데이터 (PC + 모바일 합산)
export interface BrandSearchDailyData {
  date: string;
  pc_impressions: number;
  pc_clicks: number;
  mobile_impressions: number;
  mobile_clicks: number;
  total_impressions: number;
  total_clicks: number;
  ctr: number; // (total_clicks / total_impressions) * 100
}

// 월별 집계 데이터
export interface BrandSearchMonthlyData {
  month: string; // 'YYYY-MM'
  month_label: string; // '2025년 12월'
  pc_impressions: number;
  pc_clicks: number;
  mobile_impressions: number;
  mobile_clicks: number;
  total_impressions: number;
  total_clicks: number;
  total_ctr: number;
  days: BrandSearchDailyData[];
}

// API 응답 타입
export interface BrandSearchAPIResponse {
  success: boolean;
  data?: {
    daily: BrandSearchDailyData[];
    monthly: BrandSearchMonthlyData[];
    summary: {
      total_impressions: number;
      total_clicks: number;
      total_ctr: number;
      pc_impressions: number;
      pc_clicks: number;
      mobile_impressions: number;
      mobile_clicks: number;
    };
    fixed_budget: {
      pc: number;
      mobile: number;
      total: number;
    };
  };
  error?: string;
}

// 업로드 요청 타입
export interface BrandSearchUploadRequest {
  clientId: string;
  data: BrandSearchInsertData[];
}

// 업로드 응답 타입
export interface BrandSearchUploadResponse {
  success: boolean;
  inserted: number;
  updated: number;
  total: number;
  errors: string[];
  error?: string;
}
