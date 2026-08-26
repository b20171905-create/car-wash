#!/usr/bin/env node

// Quick script to encode a database password for use in connection URIs
// Usage: node scripts/encode_password.js

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.log('Enter your Supabase database password (will be encoded for safe use in URLs):');

let password = '';

rl.on('data', (data) => {
  password = data.toString().trim();
  const encoded = encodeURIComponent(password);
  console.log('\nEncoded password:');
  console.log(encoded);
  console.log('\nUse this in your DATABASE_URL:');
  console.log(`postgresql://postgres:${encoded}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`);
  process.exit(0);
});
