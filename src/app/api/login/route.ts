import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { createAccessToken } from '@/src/server/auth';
import { prisma } from '@/src/server/prisma';
import { serializeUser } from '@/src/server/serializers';
import { createRateLimit, createRateLimitResponse } from '@/src/lib/rate-limit';
import { csrfProtection } from '@/src/lib/csrf';

// Rate limit: 5 attempts per 15 minutes per IP
const loginRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyPrefix: 'login',
});

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Check rate limit
        const rateLimitResult = await loginRateLimit(request);
        if (!rateLimitResult.success) {
            return createRateLimitResponse(rateLimitResult.resetTime);
        }

        // Check CSRF token (if enabled)
        const csrfResult = await csrfProtection(request);
        if (!csrfResult.valid) {
            return csrfResult.response!;
        }

        // Parse body with timeout handling
        const body = await request.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
        }

        const email = body?.email?.trim?.()?.toLowerCase();
        const password = body?.password;

        if (!email || !password) {
            return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
        }

        let user: any = null;

        // E2E Test Bypass — ONLY in development
        if (process.env.NODE_ENV !== 'production' && email === 'admin@admin.com' && password === 'admin') {
            user = {
                id: 1,
                email: 'admin@admin.com',
                name: 'Test Admin',
                role: 'admin',
                password: await bcrypt.hash('admin', 10),
                createdAt: new Date(),
                updatedAt: new Date(),
                emailVerifiedAt: new Date(),
            } as any;
        } else {
            // Find user - optimized query
            user = await prisma.user.findUnique({
                where: { email },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    password: true,
                }
            });
        }

        if (!user) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        // Create token
        const token = await createAccessToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });

        // Prepare response
        const safeUser = serializeUser(user);
        const response = NextResponse.json({
            access_token: token,
            token_type: 'Bearer',
            user: safeUser,
        });

        // Set auth cookie
        response.cookies.set('kf_token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        });

        // Add security headers
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-XSS-Protection', '1; mode=block');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

        const duration = Date.now() - startTime;
        console.log(`[Login] Success for ${email} in ${duration}ms`);

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'Login failed. Please try again.' },
            { status: 500 }
        );
    }
}
