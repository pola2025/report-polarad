#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSlug() {
  const { data, error } = await supabase
    .from('polarad_clients')
    .update({ slug: 'naratton', client_id: 'naratton' })
    .eq('id', 'c2f60730-f8c1-4361-b9fc-3b44725c3955')
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Updated:', data[0].client_name, '-> slug:', data[0].slug);
}

updateSlug();
