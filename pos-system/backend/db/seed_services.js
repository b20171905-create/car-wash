const { v4: uuid } = require('uuid');
const db = require('./index');

const services = [
  { name: 'Bike Wash', price: 150, duration_minutes: 15 },
  { name: 'Bike Wash YBR', price: 250, duration_minutes: 20 },
  { name: 'Bike Diesel', price: 100, duration_minutes: 10 },
  { name: 'Car Wash (SEDAN)', price: 400, duration_minutes: 30 },
  { name: 'Car Wash (SUV)', price: 600, duration_minutes: 40 },
  { name: 'Car Service (SEDAN)', price: 700, duration_minutes: 60 },
  { name: 'Car Service (SUV)', price: 1000, duration_minutes: 90 },
  { name: 'Rikshaw/AUTO Wash', price: 400, duration_minutes: 25 },
  { name: 'Rikshaw/AUTO Service', price: 500, duration_minutes: 45 },
  { name: 'Compound Polish', price: 3000, duration_minutes: 120 },
  { name: 'Gernal Service', price: 4000, duration_minutes: 180 },
];

try {
  const seedTransaction = db.transaction(() => {
    // Clean existing services
    db.prepare('DELETE FROM services').run();

    const insertService = db.prepare(
      `INSERT INTO services (id, name, description, price, duration_minutes) VALUES (?, ?, '', ?, ?)`
    );

    for (const s of services) {
      insertService.run(uuid(), s.name, s.price, s.duration_minutes);
    }
  });

  seedTransaction();
  console.log('Successfully seeded services!');
} catch (error) {
  console.error('Failed to seed services:', error);
  process.exit(1);
}
