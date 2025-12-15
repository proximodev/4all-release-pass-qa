import * as dotenv from 'dotenv';
dotenv.config();

console.log('Worker starting...');
console.log('Environment check:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('- PAGE_SPEED_API_KEY:', process.env.PAGE_SPEED_API_KEY ? 'Set' : 'Missing');

// TODO: Add worker loop and provider implementations in Phase 6.2+
console.log('Worker ready (awaiting implementation)');
