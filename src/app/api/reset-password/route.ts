import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/server/prisma';

export async function POST(request: NextRequest) {


    const body = await request.json().catch(() => null);
    const token = body?.token;
    const email = body?.email?.trim?.();
    const password = body?.password;

    if (!token || !email || !password || String(password).length < 6) {
        return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
    }

    try {
        const record = await prisma.passwordReset.findUnique({ where: { email } });

        if (!record || record.token !== token) {
            return NextResponse.json({ message: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 });
        }

        const createdAt = record.createdAt ? new Date(record.createdAt) : null;
        if (!createdAt || createdAt.getTime() + 60 * 60 * 1000 < Date.now()) {
            await prisma.passwordReset.delete({ where: { email } }).catch(() => null);
            return NextResponse.json({ message: 'Reset link has expired. Please request a new one.' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json({ message: 'User not found.' }, { status: 404 });
        }

        const hashed = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
        });

        await prisma.passwordReset.delete({ where: { email } }).catch(() => null);

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully! You can now login with your new password.',
        });
    } catch {
        return NextResponse.json(
            { message: 'Database unavailable. Verify DATABASE_URL and PostgreSQL TLS settings.' },
            { status: 503 }
        );
    }
}
