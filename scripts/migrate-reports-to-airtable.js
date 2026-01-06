/**
 * Supabase -> Airtable 리포트 데이터 마이그레이션 스크립트
 *
 * 사용법:
 * cd dashboard && node ../scripts/migrate-reports-to-airtable.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Airtable 설정
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_REPORTS_BASE_ID || 'appJlOqnadLsMJQYw';
const AIRTABLE_REPORTS_TABLE = process.env.AIRTABLE_REPORTS_TABLE_ID || 'tbl4BAtILQRH7JQaG';
const AIRTABLE_COMMENTS_TABLE = process.env.AIRTABLE_COMMENTS_TABLE_ID || 'tbl5u19uUCdPl4TCg';

async function airtableInsert(tableId, records) {
  // Airtable은 한 번에 최대 10개 레코드만 삽입 가능
  const results = [];

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);

    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: batch }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Airtable insert error:', data.error);
      throw new Error(data.error.message);
    }

    results.push(...data.records);
    console.log(`  Inserted batch ${Math.floor(i / 10) + 1}/${Math.ceil(records.length / 10)}`);
  }

  return results;
}

async function migrateReports() {
  console.log('=== Migrating Reports ===\n');

  // Supabase에서 리포트 조회
  const { data: reports, error } = await supabase
    .from('polarad_reports')
    .select(`
      *,
      polarad_clients (
        id,
        client_name,
        slug
      )
    `)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase error:', error);
    return;
  }

  console.log(`Found ${reports.length} reports in Supabase\n`);

  if (reports.length === 0) {
    console.log('No reports to migrate');
    return;
  }

  // Airtable 형식으로 변환
  const airtableRecords = reports.map(report => ({
    fields: {
      id: report.id,
      client_id: report.client_id,
      client_slug: report.polarad_clients?.slug || '',
      report_type: report.report_type,
      period_start: report.period_start,
      period_end: report.period_end,
      year: report.year,
      month: report.month || null,
      week: report.week || null,
      status: report.status,
      published_at: report.published_at || null,
      summary_data: report.summary_data ? JSON.stringify(report.summary_data) : null,
      ai_insights: report.ai_insights ? JSON.stringify(report.ai_insights) : null,
      ai_generated_at: report.ai_generated_at || null,
      created_at: report.created_at,
      updated_at: report.updated_at,
      created_by: report.created_by || null,
    }
  }));

  // Airtable에 삽입
  console.log('Inserting into Airtable...');
  const inserted = await airtableInsert(AIRTABLE_REPORTS_TABLE, airtableRecords);
  console.log(`\nMigrated ${inserted.length} reports\n`);

  return reports;
}

async function migrateComments() {
  console.log('=== Migrating Comments ===\n');

  // Supabase에서 코멘트 조회
  const { data: comments, error } = await supabase
    .from('polarad_report_comments')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase error:', error);
    return;
  }

  console.log(`Found ${comments.length} comments in Supabase\n`);

  if (comments.length === 0) {
    console.log('No comments to migrate');
    return;
  }

  // Airtable 형식으로 변환
  const airtableRecords = comments.map(comment => ({
    fields: {
      id: comment.id,
      report_id: comment.report_id,
      content: comment.content,
      content_html: comment.content_html || null,
      author_name: comment.author_name || 'Unknown',
      author_role: comment.author_role || null,
      is_visible: comment.is_visible || false,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
    }
  }));

  // Airtable에 삽입
  console.log('Inserting into Airtable...');
  const inserted = await airtableInsert(AIRTABLE_COMMENTS_TABLE, airtableRecords);
  console.log(`\nMigrated ${inserted.length} comments\n`);

  return comments;
}

async function main() {
  console.log('========================================');
  console.log('Supabase -> Airtable Migration');
  console.log('========================================\n');

  console.log('Supabase URL:', supabaseUrl);
  console.log('Airtable Base:', AIRTABLE_BASE_ID);
  console.log('Reports Table:', AIRTABLE_REPORTS_TABLE);
  console.log('Comments Table:', AIRTABLE_COMMENTS_TABLE);
  console.log('');

  try {
    await migrateReports();
    await migrateComments();

    console.log('========================================');
    console.log('Migration completed successfully!');
    console.log('========================================');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
