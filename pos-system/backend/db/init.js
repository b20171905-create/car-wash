// One-time seed script: creates first branch + owner login + sample services.
// Run with: npm run initdb

const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./index');

(async () => {
  try {
    console.log('[INIT] Starting database initialization...');
    
    // Wait for database schema to be initialized
    console.log('[INIT] Waiting for database to be ready...');
    await db.databaseReady;
    console.log('[INIT] Database is ready!');
    
    const branchId = uuid();
    const ownerId = uuid();

    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerPassword = process.env.OWNER_PASSWORD;
    const ownerName = process.env.OWNER_NAME || 'Owner';

    console.log('[INIT] Owner email:', ownerEmail);
    
    if (!ownerEmail || !ownerPassword) {
      throw new Error('OWNER_EMAIL and OWNER_PASSWORD must be set before initializing the database.');
    }

    // Check if owner exists
    console.log('[INIT] Checking if owner already exists...');
    const existingOwner = await db.prepare(`SELECT id FROM users WHERE role = 'owner' LIMIT 1`).get();
    if (existingOwner) {
      console.log('[INIT] Owner already exists. Skipping seed.');
      process.exit(0);
    }
    console.log('[INIT] No existing owner found, creating new one...');

    // Create branch
    console.log('[INIT] Creating main branch...');
    await db.prepare(`INSERT INTO branches (id, name, address, phone) VALUES (?, ?, ?, ?)`).run(
      branchId,
      'Main Branch',
      'Change this address',
      ''
    );
    console.log('✓ Created main branch');

    // Create owner user
    console.log('[INIT] Hashing password...');
    const passwordHash = bcrypt.hashSync(ownerPassword, 10);
    console.log('[INIT] Creating owner user...');
    await db.prepare(`INSERT INTO users (id, branch_id, name, email, password_hash, role, active) VALUES (?, NULL, ?, ?, ?, 'owner', true)`).run(
      ownerId,
      ownerName,
      ownerEmail,
      passwordHash
    );
    console.log(`✓ Created owner account: ${ownerEmail}`);

    // Create services
    console.log('[INIT] Creating services...');
    const services = [
      ['Bike Wash', 15, 150],
      ['Bike Wash YBR', 20, 250],
      ['Bike Diesel', 10, 100],
      ['Car Wash (SEDAN)', 30, 400],
      ['Car Wash (SUV)', 40, 600],
      ['Car Service (SEDAN)', 60, 700],
      ['Car Service (SUV)', 90, 1000],
      ['Rikshaw/AUTO Wash', 25, 400],
      ['Rikshaw/AUTO Service', 45, 500],
      ['Compound Polish', 120, 3000],
      ['Gernal Service', 180, 4000],
    ];

    for (const [name, duration, price] of services) {
      await db.prepare(`INSERT INTO services (id, name, description, price, duration_minutes, active) VALUES (?, ?, ?, ?, ?, true)`).run(
        uuid(),
        name,
        '',
        price,
        duration
      );
    }
    console.log(`✓ Created ${services.length} services`);

    console.log('\n✅ Database seed complete!');
    console.log(`Branch ID: ${branchId}`);
    console.log(`Owner Email: ${ownerEmail}`);
    console.log('[INIT] Exiting init.js...');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database init failed:', error.message);
    console.error('[INIT] Stack:', error.stack);
    process.exit(1);
  }
})();
