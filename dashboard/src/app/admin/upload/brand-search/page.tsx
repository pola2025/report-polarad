'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
} from 'lucide-react';
import type { BrandSearchUploadResponse } from '@/types/brand-search';

interface Client {
  id: string;
  client_name: string;
  slug: string;
  naver_type: string;
}

export default function BrandSearchUploadPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BrandSearchUploadResponse | null>(null);

  // 클라이언트 목록 조회
  const fetchClients = useCallback(async (key: string) => {
    try {
      const res = await fetch('/api/admin/clients', {
        headers: { 'x-admin-key': key },
      });
      if (res.ok) {
        const data = await res.json();
        // brand_search 타입만 필터
        const brandSearchClients = (data.clients || []).filter(
          (c: Client) => c.naver_type === 'brand_search'
        );
        setClients(brandSearchClients);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // 로그인
  const handleLogin = async () => {
    const success = await fetchClients(adminKey);
    if (success) {
      localStorage.setItem('polarad_admin_key', adminKey);
      setIsAuthenticated(true);
    } else {
      alert('관리자 키가 올바르지 않습니다.');
    }
  };

  // 저장된 키 확인
  useEffect(() => {
    const savedKey = localStorage.getItem('polarad_admin_key');
    if (savedKey) {
      setAdminKey(savedKey);
      fetchClients(savedKey).then((success) => {
        if (success) setIsAuthenticated(true);
      });
    }
  }, [fetchClients]);

  // 파일 선택
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    // 미리보기 (처음 10줄)
    const text = await selectedFile.text();
    const lines = text.split('\n').slice(0, 10);
    setCsvPreview(lines);
  };

  // 업로드
  const handleUpload = async () => {
    if (!selectedClientId || !file) {
      alert('클라이언트와 파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('clientId', selectedClientId);
      formData.append('file', file);

      const res = await fetch('/api/admin/upload/brand-search', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
        },
        body: formData,
      });

      const data: BrandSearchUploadResponse = await res.json();
      setResult(data);

      if (data.success) {
        // 파일 초기화
        setFile(null);
        setCsvPreview([]);
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '업로드 실패',
        inserted: 0,
        updated: 0,
        total: 0,
        errors: [],
      });
    } finally {
      setUploading(false);
    }
  };

  // 인증 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              관리자 인증
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="관리자 키를 입력하세요"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Button onClick={handleLogin} className="w-full">
                로그인
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-neutral-500 hover:text-neutral-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-neutral-900">
            브랜드검색 CSV 업로드
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 클라이언트 선택 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. 클라이언트 선택</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-neutral-500">
                브랜드검색 타입의 클라이언트가 없습니다.
              </p>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">클라이언트 선택...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.client_name} ({client.slug})
                  </option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>

        {/* 파일 업로드 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. CSV 파일 업로드</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <FileSpreadsheet className="w-10 h-10 text-neutral-400" />
                <span className="text-neutral-600">
                  {file ? file.name : 'CSV 파일을 선택하세요'}
                </span>
                <span className="text-xs text-neutral-400">
                  네이버 광고 &gt; 보고서 &gt; 캠페인 보고서 내보내기
                </span>
              </label>
            </div>

            {/* CSV 미리보기 */}
            {csvPreview.length > 0 && (
              <div className="bg-neutral-100 rounded-lg p-3 overflow-x-auto">
                <p className="text-xs text-neutral-500 mb-2">미리보기 (처음 10줄)</p>
                <pre className="text-xs text-neutral-700 whitespace-pre-wrap">
                  {csvPreview.join('\n')}
                </pre>
              </div>
            )}

            {/* CSV 형식 안내 */}
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800 mb-1">CSV 형식:</p>
              <code className="text-xs text-blue-700 block">
                캠페인,일별,광고그룹,노출수,클릭수
                <br />
                브랜드검색광고,2025.12.03.,브랜드검색광고_PC,49,31
                <br />
                브랜드검색광고,2025.12.03.,브랜드검색광고_모바일,80,57
              </code>
            </div>
          </CardContent>
        </Card>

        {/* 업로드 버튼 */}
        <Button
          onClick={handleUpload}
          disabled={!selectedClientId || !file || uploading}
          className="w-full"
          size="lg"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              업로드 중...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              업로드
            </>
          )}
        </Button>

        {/* 결과 표시 */}
        {result && (
          <Card className={result.success ? 'border-green-300' : 'border-red-300'}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      result.success ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {result.success ? '업로드 완료!' : '업로드 실패'}
                  </p>
                  <p className="text-sm text-neutral-600 mt-1">
                    총 {result.total}건 중 {result.inserted}건 추가, {result.updated}건
                    업데이트
                  </p>
                  {result.errors.length > 0 && (
                    <ul className="text-xs text-red-600 mt-2 list-disc list-inside">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...외 {result.errors.length - 5}건</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
