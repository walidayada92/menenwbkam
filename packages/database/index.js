const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
module.exports = { ...require('@prisma/client'), prisma: new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC', max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 }),
}) };
