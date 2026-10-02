import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
    await prisma.user.upsert({
      where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
      update: { role: 'ADMIN' },
      create: {
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        passwordHash: await hash(process.env.ADMIN_PASSWORD, 12),
        role: 'ADMIN',
      },
    });
}
main().finally(() => prisma.$disconnect());
