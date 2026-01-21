import Airtable from 'airtable';

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });

async function checkNarattonMeta() {
  const base = airtable.base('appN2KzUoORRrb8X9');

  console.log('\n📊 나라똔 Airtable Meta 데이터 (12/6 ~ 12/17):');

  const records = await base('tblmC9Ft2ioXKXsrL')
    .select({
      filterByFormula: `AND(
        {date_start} >= '2024-12-06',
        {date_start} <= '2024-12-17',
        {source} = 'meta'
      )`,
      sort: [{ field: 'date_start', direction: 'asc' }]
    })
    .all();

  console.log(`총 ${records.length}건\n`);

  if (records.length === 0) {
    console.log('⚠️  Airtable에 데이터 없음!');
  } else {
    records.forEach(record => {
      console.log({
        date: record.get('date_start'),
        spend: record.get('spend'),
        impressions: record.get('impressions'),
        clicks: record.get('clicks'),
        leads: record.get('leads')
      });
    });
  }
}

checkNarattonMeta();
