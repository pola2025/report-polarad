const fs = require('fs');

const data = fs.readFileSync('brand-search-raw-data.tsv', 'utf-8');
const lines = data.trim().split('\n');

// 캠페인별, 디바이스별 집계
const stats = new Map();

for (const line of lines) {
  const cols = line.split('\t');
  if (cols.length < 16) continue;

  const date = cols[0];
  const campaignId = cols[2];
  const deviceCode = cols[10];
  const device = deviceCode === 'P' ? 'PC' : deviceCode === 'M' ? 'Mobile' : 'Unknown';
  const impressions = parseInt(cols[11]) || 0;
  const clicks = parseInt(cols[12]) || 0;

  const key = `${campaignId}_${device}`;
  const existing = stats.get(key) || { campaignId, device, impressions: 0, clicks: 0 };
  stats.set(key, {
    campaignId,
    device,
    impressions: existing.impressions + impressions,
    clicks: existing.clicks + clicks,
  });
}

console.log('=== 캠페인별/디바이스별 합계 ===\n');

const results = Array.from(stats.values());
results.sort((a, b) => a.campaignId.localeCompare(b.campaignId) || a.device.localeCompare(b.device));

let totalImp = 0, totalClicks = 0;
for (const r of results) {
  console.log(`${r.campaignId} [${r.device}]: 노출 ${r.impressions}, 클릭 ${r.clicks}`);
  totalImp += r.impressions;
  totalClicks += r.clicks;
}

console.log(`\n합계: 노출 ${totalImp}, 클릭 ${totalClicks}`);
