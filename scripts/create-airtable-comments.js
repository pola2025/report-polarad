/**
 * Airtable 리포트 코멘트 테이블 생성 스크립트
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
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
    console.error(`Error creating ${tableName}:`, JSON.stringify(data.error, null, 2));
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

  console.log('Creating Report Comments table...\n');

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

  if (commentsTable) {
    console.log(`\nAdd to .env.local:`);
    console.log(`AIRTABLE_COMMENTS_TABLE_ID=${commentsTable.id}`);
  }
}

main().catch(console.error);
