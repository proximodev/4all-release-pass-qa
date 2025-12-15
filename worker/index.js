require('dotenv').config();

console.log('Worker starting...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');

// Keep process alive
setInterval(() => {
	console.log('Worker heartbeat:', new Date().toISOString());
}, 30000);