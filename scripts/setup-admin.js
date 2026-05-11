// Script to generate bcrypt hash for admin password
// Run: node scripts/setup-admin.js

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

async function generatePasswordHash(password) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  console.log('Password hash generated:');
  console.log(hash);
  console.log('\nAdd this to your .env file:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
}

const password = process.argv[2] || 'admin123';

generatePasswordHash(password);
