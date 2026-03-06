"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  client_name: string;
  slug: string;
}

interface UploadResult {
  success: boolean;
  message: string;
  summary?: {
    client: string;
    totalRecords: number;
    dateRange: { start: string; end: string };
    uniqueKeywords: number;
    totalImpressions: number;
    totalClicks: number;
    totalCost: number;
    keywordStats: Record<
      string,
      { impressions: number; clicks: number; cost: number }
    >;
  };
  error?: string;
}

export default function NaverUploadPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/clients");

      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("클라이언트 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      alert("CSV 파일만 업로드 가능합니다.");
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file || !selectedClient) {
      alert("클라이언트와 파일을 선택해주세요.");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", selectedClient);

      const response = await fetch("/api/admin/upload/naver", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          `서버 오류 (${response.status}). 파일이 너무 크거나 처리 시간을 초과했을 수 있습니다.`,
        );
      }

      const data = await response.json();
      setResult(data);

      if (data.success) {
        setFile(null);
        // 파일 입력 초기화
        const fileInput = document.getElementById(
          "csv-file",
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch (error) {
      console.error("업로드 실패:", error);
      setResult({ success: false, message: "업로드 중 오류가 발생했습니다." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                네이버 플레이스 광고 업로드
              </h1>
              <p className="text-sm text-gray-500">
                CSV 파일을 업로드하여 데이터를 저장합니다
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* 업로드 폼 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                CSV 파일 업로드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 클라이언트 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    클라이언트 선택 *
                  </label>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">클라이언트를 선택하세요</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.client_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 파일 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CSV 파일 *
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      id="csv-file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="csv-file" className="cursor-pointer">
                      {file ? (
                        <div className="flex items-center justify-center gap-2 text-blue-600">
                          <FileText className="h-6 w-6" />
                          <span className="font-medium">{file.name}</span>
                          <span className="text-gray-500">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      ) : (
                        <div className="text-gray-500">
                          <Upload className="h-10 w-10 mx-auto mb-2" />
                          <p className="font-medium">클릭하여 파일 선택</p>
                          <p className="text-sm">또는 파일을 여기에 드래그</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* 업로드 버튼 */}
                <Button
                  onClick={handleUpload}
                  disabled={!file || !selectedClient || uploading}
                  className="w-full"
                >
                  {uploading ? "업로드 중..." : "업로드"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 결과 표시 */}
          {result && (
            <Card
              className={result.success ? "border-green-200" : "border-red-200"}
            >
              <CardContent className="pt-6">
                <div
                  className={`flex items-start gap-3 ${result.success ? "text-green-700" : "text-red-700"}`}
                >
                  {result.success ? (
                    <CheckCircle className="h-6 w-6 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-6 w-6 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{result.message}</p>
                    {result.success && result.summary && (
                      <div className="mt-4 space-y-4">
                        {/* 요약 정보 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-gray-50 p-3 rounded-md">
                            <div className="text-lg font-bold text-gray-900">
                              {formatNumber(result.summary.totalRecords)}건
                            </div>
                            <div className="text-sm text-gray-500">
                              총 레코드
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <div className="text-lg font-bold text-gray-900">
                              {result.summary.uniqueKeywords}개
                            </div>
                            <div className="text-sm text-gray-500">키워드</div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <div className="text-lg font-bold text-gray-900">
                              {formatNumber(result.summary.totalClicks)}
                            </div>
                            <div className="text-sm text-gray-500">총 클릭</div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <div className="text-lg font-bold text-gray-900">
                              {formatNumber(result.summary.totalCost)}원
                            </div>
                            <div className="text-sm text-gray-500">총 비용</div>
                          </div>
                        </div>

                        {/* 기간 */}
                        <div className="text-sm text-gray-600">
                          기간: {result.summary.dateRange.start} ~{" "}
                          {result.summary.dateRange.end}
                        </div>

                        {/* 키워드별 상세 */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            키워드별 요약
                          </h4>
                          <div className="max-h-60 overflow-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left">
                                    키워드
                                  </th>
                                  <th className="px-3 py-2 text-right">노출</th>
                                  <th className="px-3 py-2 text-right">클릭</th>
                                  <th className="px-3 py-2 text-right">비용</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {Object.entries(result.summary.keywordStats)
                                  .sort((a, b) => b[1].cost - a[1].cost)
                                  .map(([keyword, stats]) => (
                                    <tr
                                      key={keyword}
                                      className="hover:bg-gray-50"
                                    >
                                      <td className="px-3 py-2">{keyword}</td>
                                      <td className="px-3 py-2 text-right">
                                        {formatNumber(stats.impressions)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {formatNumber(stats.clicks)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {formatNumber(stats.cost)}원
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                    {!result.success && result.error && (
                      <p className="mt-2 text-sm">{result.error}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 도움말 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CSV 파일 형식</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                네이버 광고 시스템에서 다운로드한 월간 리포트 CSV를
                업로드하세요.
              </p>
              <div className="bg-gray-50 p-3 rounded-md text-xs font-mono overflow-x-auto">
                <p className="text-gray-500 mb-1"># 필수 컬럼:</p>
                <p>
                  일별, 검색어, 노출수, 클릭수, 클릭률(%), 평균클릭비용, 총비용,
                  평균노출순위
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href="/admin"
                  className="text-sm text-blue-600 hover:underline"
                >
                  ← 관리자 페이지로 돌아가기
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
