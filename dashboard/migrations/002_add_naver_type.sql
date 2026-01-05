-- 네이버 광고 타입 컬럼 추가 (place: 플레이스, brand_search: 브랜드검색)
ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS naver_type VARCHAR(20) DEFAULT 'place';

-- 나라똔 클라이언트를 브랜드검색으로 설정
UPDATE polarad_clients
SET naver_type = 'brand_search'
WHERE slug = '나라똔';

-- 확인
SELECT client_name, slug, naver_type FROM polarad_clients;
