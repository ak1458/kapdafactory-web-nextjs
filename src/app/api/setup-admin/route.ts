import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/server/prisma';
import { createRateLimit, createRateLimitResponse } from '@/src/lib/rate-limit';
import { csrfProtection } from '@/src/lib/csrf';

const DEFAULT_SETUP_EMAIL = 'admin@admin.com';
const DEFAULT_SETUP_PASSWORD = 'admin123';

// Rate limit: 10 attempts per hour per IP
const setupAdminRateLimit = createRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyPrefix: 'setup-admin',
});

function getProvidedKey(request: NextRequest) {
    const headerKey = request.headers.get('x-setup-admin-key');
    if (headerKey?.trim()) {
        return headerKey.trim();
    }

    const queryKey = request.nextUrl.searchParams.get('key');
    return queryKey?.trim() || '';
}

async function handleSetup(request: NextRequest) {
    // Check rate limit
    const rateLimitResult = await setupAdminRateLimit(request);
    if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult.resetTime);
    }

    // Check CSRF token
    const csrfResult = await csrfProtection(request);
    if (!csrfResult.valid) {
        return csrfResult.response!;
    }

    const configuredKey = String(process.env.KF_SETUP_ADMIN_KEY || '').trim();
    const allowInProd = String(process.env.KF_ALLOW_SETUP_ADMIN_IN_PROD || '').trim() === 'true';

    if (process.env.NODE_ENV === 'production' && !allowInProd) {
        return NextResponse.json({ message: 'Not found.' }, { status: 404 });
    }

    if (!configuredKey) {
        return NextResponse.json(
            { message: 'Setup route disabled. Configure KF_SETUP_ADMIN_KEY to enable it.' },
            { status: 404 }
        );
    }

    const providedKey = getProvidedKey(request);
    if (!providedKey || providedKey !== configuredKey) {
        return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }

    const body = request.method === 'POST' ? await request.json().catch(() => null) : null;
    const rawEmail =
        typeof body?.email === 'string' && body.email.trim()
            ? body.email.trim().toLowerCase()
            : DEFAULT_SETUP_EMAIL;
    const rawPassword =
        typeof body?.password === 'string' && body.password.trim()
            ? body.password.trim()
            : DEFAULT_SETUP_PASSWORD;
    const rawName =
        typeof body?.name === 'string' && body.name.trim()
            ? body.name.trim()
            : 'Admin';

    if (rawPassword.length < 6) {
        return NextResponse.json(
            { message: 'Password must be at least 6 characters.' },
            { status: 422 }
        );
    }

    try {
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        const user = await prisma.user.upsert({
            where: { email: rawEmail },
            update: {
                password: hashedPassword,
                name: rawName,
                role: 'admin',
            },
            create: {
                email: rawEmail,
                password: hashedPassword,
                name: rawName,
                role: 'admin',
            },
        });

        const response = NextResponse.json({
            success: true,
            message: `Admin account ${user.email} is ready.`,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
        });

        // Add security headers
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');

        return response;
    } catch (error) {
        console.error('Setup admin error:', error);
        return NextResponse.json(
            { message: 'Failed to setup admin user.' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return handleSetup(request);
}

export async function POST(request: NextRequest) {
    return handleSetup(request);
}
