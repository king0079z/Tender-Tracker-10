import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Pool } = pg;

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Azure connection
const azurePool = new Pool({
  host: process.env.VITE_AZURE_DB_HOST,
  database: process.env.VITE_AZURE_DB_NAME,
  user: process.env.VITE_AZURE_DB_USER,
  password: process.env.VITE_AZURE_DB_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateData() {
  try {
    console.log('Starting migration...');

    // Migrate timelines
    console.log('Migrating timelines...');
    const { data: timelines, error: timelinesError } = await supabase
      .from('timelines')
      .select('*');

    if (timelinesError) throw timelinesError;

    for (const timeline of timelines) {
      await azurePool.query(
        `INSERT INTO timelines (
          id, company_id, company_name,
          nda_received_date, nda_received_completed,
          nda_signed_date, nda_signed_completed,
          rfi_sent_date, rfi_sent_completed,
          rfi_due_date, rfi_due_completed,
          offer_received_date, offer_received_completed,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (company_id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          nda_received_date = EXCLUDED.nda_received_date,
          nda_received_completed = EXCLUDED.nda_received_completed,
          nda_signed_date = EXCLUDED.nda_signed_date,
          nda_signed_completed = EXCLUDED.nda_signed_completed,
          rfi_sent_date = EXCLUDED.rfi_sent_date,
          rfi_sent_completed = EXCLUDED.rfi_sent_completed,
          rfi_due_date = EXCLUDED.rfi_due_date,
          rfi_due_completed = EXCLUDED.rfi_due_completed,
          offer_received_date = EXCLUDED.offer_received_date,
          offer_received_completed = EXCLUDED.offer_received_completed,
          updated_at = now()`,
        [
          timeline.id,
          timeline.company_id,
          timeline.company_name,
          timeline.nda_received_date,
          timeline.nda_received_completed,
          timeline.nda_signed_date,
          timeline.nda_signed_completed,
          timeline.rfi_sent_date,
          timeline.rfi_sent_completed,
          timeline.rfi_due_date,
          timeline.rfi_due_completed,
          timeline.offer_received_date,
          timeline.offer_received_completed,
          timeline.created_at,
          timeline.updated_at
        ]
      );
    }

    // Migrate communications
    console.log('Migrating communications...');
    const { data: communications, error: commsError } = await supabase
      .from('communications')
      .select('*');

    if (commsError) throw commsError;

    for (const comm of communications) {
      await azurePool.query(
        `INSERT INTO communications (
          id, company_id, subject, content,
          sent_date, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          subject = EXCLUDED.subject,
          content = EXCLUDED.content,
          updated_at = now()`,
        [
          comm.id,
          comm.company_id,
          comm.subject,
          comm.content,
          comm.sent_date,
          comm.created_by,
          comm.created_at,
          comm.updated_at
        ]
      );
    }

    // Migrate communication responses
    console.log('Migrating communication responses...');
    const { data: responses, error: respError } = await supabase
      .from('communication_responses')
      .select('*');

    if (respError) throw respError;

    for (const resp of responses) {
      await azurePool.query(
        `INSERT INTO communication_responses (
          id, communication_id, response,
          responder_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          response = EXCLUDED.response,
          updated_at = now()`,
        [
          resp.id,
          resp.communication_id,
          resp.response,
          resp.responder_name,
          resp.created_at,
          resp.updated_at
        ]
      );
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await azurePool.end();
  }
}

migrateData().catch(console.error);