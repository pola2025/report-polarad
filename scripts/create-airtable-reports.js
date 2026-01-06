/**
 * Airtable 리포트 테이블 생성 스크립트
 *
 * 사용법:
 * AIRTABLE_API_KEY="xxx" node scripts/create-airtable-reports.js
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

// H.E.A 판교 Base에 리포트 테이블 생성 (또는 별도 Base 사용)
const BASE_ID = process.env.AIRTABLE_HEA_BASE_ID || 'appJlOqnadLsMJQYw';

async function createTable(tableName, fields) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: tableName,
      fields: fields,
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error(`Error creating ${tableName}:`, data.error);
    return null;
  }

  console.log(`Created table: ${tableName} (ID: ${data.id})`);
  return data;
}

async function main() {
  if (!AIRTABLE_API_KEY) {
    console.error('AIRTABLE_API_KEY is required');
    process.exit(1);
  }

  console.log('Creating Airtable tables for reports...\n');
  console.log('Base ID:', BASE_ID);
  console.log('');

  // 1. Reports 테이블 생성
  const reportsFields = [
    { name: 'id', type: 'singleLineText' },
    { name: 'client_id', type: 'singleLineText' },
    { name: 'client_slug', type: 'singleLineText' },
    { name: 'report_type', type: 'singleSelect', options: { choices: [
      { name: 'monthly' },
      { name: 'weekly' },
    ]}},
    { name: 'period_start', type: 'date', options: { dateFormat: { name: 'iso' }}},
    { name: 'period_end', type: 'date', options: { dateFormat: { name: 'iso' }}},
    { name: 'year', type: 'number', options: { precision: 0 }},
    { name: 'month', type: 'number', options: { precision: 0 }},
    { name: 'week', type: 'number', options: { precision: 0 }},
    { name: 'status', type: 'singleSelect', options: { choices: [
      { name: 'draft' },
      { name: 'published' },
      { name: 'archived' },
    ]}},
    { name: 'published_at', type: 'dateTime', options: {
      dateFormat: { name: 'iso' },
      timeFormat: { name: '24hour' },
      timeZone: 'Asia/Seoul'
    }},
    { name: 'summary_data', type: 'multilineText' }, // JSON string
    { name: 'ai_insights', type: 'multilineText' },  // JSON string
    { name: 'ai_generated_at', type: 'dateTime', options: {
      dateFormat: { name: 'iso' },
      timeFormat: { name: '24hour' },
      timeZone: 'Asia/Seoul'
    }},
    { name: 'created_at', type: 'dateTime', options: {
      dateFormat: { name: 'iso' },
      timeFormat: { name: '24hour' },
      timeZone: 'Asia/Seoul'
    }},
    { name: 'updated_at', type: 'dateTime', options: {
      dateFormat: { name: 'iso' },
      timeFormat: { name: '24hour' },
      timeZone: 'Asia/Seoul'
    }},
    { name: 'created_by', type: 'singleLineText' },
  ];

  const reportsTable = await createTable('polarad_reports', reportsFields);

  // 2. Report Comments 테이블 생성
  const commentsFields = [
    { name: 'id', type: 'singleLineText' },
    { name: 'report_id', type: 'singleLineText' },
    { name: 'content', type: 'multilineText' },
    { name: 'content_html', type: 'multilineText' },
    { name: 'author_name', type: 'singleLineText' },
    { name: 'author_role', type: 'singleLineText' },
    { name: 'is_visible', type: 'checkbox', options: { icon: 'check', color: 'greenBright' }},
    { name: 'created_at', type: 'dateTime', options: {
      dateFormat: { name: 'iso' },
      timeFormat: { name: '24hour' },
      timeZone: 'Asia/Seoul'
    }},
    { name: 'updated_at', type: 'dateTime', options: {
      dateFormat: { name: 'iso' },
      timeFormat: { name: '24hour' },
      timeZone: 'Asia/Seoul'
    }},
  ];

  const commentsTable = await createTable('polarad_report_comments', commentsFields);

  console.log('\n========================================');
  console.log('RESULTS');
  console.log('========================================');

  if (reportsTable) {
    console.log(`\nReports Table:`);
    console.log(`  Name: polarad_reports`);
    console.log(`  Table ID: ${reportsTable.id}`);
  }

  if (commentsTable) {
    console.log(`\nComments Table:`);
    console.log(`  Name: polarad_report_comments`);
    console.log(`  Table ID: ${commentsTable.id}`);
  }

  console.log('\n========================================');
  console.log('Add these to your .env.local:');
  console.log('========================================');
  if (reportsTable) {
    console.log(`AIRTABLE_REPORTS_TABLE_ID=${reportsTable.id}`);
  }
  if (commentsTable) {
    console.log(`AIRTABLE_COMMENTS_TABLE_ID=${commentsTable.id}`);
  }
}

main().catch(console.error);
