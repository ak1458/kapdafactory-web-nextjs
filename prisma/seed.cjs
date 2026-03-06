const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@admin.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';

    const hashed = await bcrypt.hash(password, 10);

    // Remove old admin@example.com user if it exists (legacy from DEPLOY.md SQL)
    await prisma.user.deleteMany({
        where: { email: { in: ['admin@example.com', 'admin@kapdafactory.com'] } },
    });

    await prisma.user.upsert({
        where: { email },
        update: {
            password: hashed,
            name: 'Admin',
            role: 'admin',
        },
        create: {
            name: 'Admin',
            email,
            password: hashed,
            role: 'admin',
        },
    });

    console.log(`Seeded admin user: ${email}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
