/**
 * One-off script: create (or update) the bootstrap ADMIN user + active 28-day
 * subscription on the production database.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret node scripts/seed-admin.mjs
 *
 * Defaults: reads ADMIN_EMAIL from env (or falls back to memory default).
 *           Password defaults to AUTH_PASSWORD env so the existing admin
 *           credential keeps working.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const email = (process.env.ADMIN_EMAIL || 'dooya989@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || process.env.AUTH_PASSWORD;

if (!password) {
  console.error('ERROR: pass ADMIN_PASSWORD env, or have AUTH_PASSWORD set in .env');
  process.exit(1);
}

const prisma = new PrismaClient();

const passwordHash = await bcrypt.hash(password, 10);
const SUBSCRIPTION_DAYS = 28;
const now = new Date();
const endAt = new Date(now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

// Upsert user with ADMIN role
const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash, role: 'ADMIN' },
  create: {
    email,
    passwordHash,
    role: 'ADMIN',
    name: 'Admin',
  },
});

// Make sure they have an active subscription (so dashboard works immediately)
const existingSub = await prisma.subscription.findFirst({
  where: { userId: user.id, status: 'ACTIVE' },
  orderBy: { endAt: 'desc' },
});

if (existingSub && existingSub.endAt > now) {
  console.log(`✓ Active subscription already exists (ends ${existingSub.endAt.toISOString().slice(0, 10)})`);
} else {
  await prisma.subscription.create({
    data: {
      userId: user.id,
      startAt: now,
      endAt,
      status: 'ACTIVE',
      amount: 100000,
      memo: 'bootstrap admin',
    },
  });
  console.log(`✓ Subscription activated until ${endAt.toISOString().slice(0, 10)}`);
}

console.log('');
console.log('🎉 Admin ready');
console.log('  email:', user.email);
console.log('  role: ', user.role);
console.log('  id:   ', user.id);

await prisma.$disconnect();
