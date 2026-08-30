const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./index');

/**
 * Ensures main branch, owner user, and default services exist in the database.
 * If no owner exists, creates one using environment variables or fallback values.
 */
async function ensureOwnerCreated(fallbackEmail = null, fallbackPassword = null) {
  await db.databaseReady;

  // Check if owner already exists
  const existingOwner = await db.prepare(`SELECT * FROM users WHERE role = 'owner' LIMIT 1`).get();
  if (existingOwner) {
    console.log('[SEED] Owner account already exists:', existingOwner.email);
    return existingOwner;
  }

  const ownerEmail = (process.env.OWNER_EMAIL || fallbackEmail || '').trim().toLowerCase();
  const ownerPassword = process.env.OWNER_PASSWORD || fallbackPassword;
  const ownerName = process.env.OWNER_NAME || 'Owner';

  if (!ownerEmail || !ownerPassword) {
    console.warn('[SEED] Skipping auto-seed: No owner email or password specified in env or login fallback.');
    return null;
  }

  console.log('[SEED] No owner found. Creating initial database seed for:', ownerEmail);

  // Ensure at least one branch exists
  let branch = await db.prepare(`SELECT id FROM branches LIMIT 1`).get();
  let branchId = branch ? branch.id : uuid();

  if (!branch) {
    await db.prepare(`INSERT INTO branches (id, name, address, phone) VALUES (?, ?, ?, ?)`).run(
      branchId,
      'Main Branch',
      'Main Location',
      ''
    );
    console.log('[SEED] ✓ Created main branch:', branchId);
  }

  // Create owner user
  const ownerId = uuid();
  const passwordHash = bcrypt.hashSync(ownerPassword, 10);
  await db.prepare(`INSERT INTO users (id, branch_id, name, email, password_hash, role, active) VALUES (?, NULL, ?, ?, ?, 'owner', true)`).run(
    ownerId,
    ownerName,
    ownerEmail,
    passwordHash
  );
  console.log(`[SEED] ✓ Created owner account: ${ownerEmail}`);

  // Ensure default services exist
  const existingServicesCountRow = await db.prepare(`SELECT COUNT(*) as count FROM services`).get();
  const servicesCount = existingServicesCountRow ? (existingServicesCountRow.count || existingServicesCountRow['COUNT(*)'] || 0) : 0;

  if (Number(servicesCount) === 0) {
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
    console.log(`[SEED] ✓ Created ${services.length} initial services`);
  }

  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(ownerId);
}

module.exports = { ensureOwnerCreated };
