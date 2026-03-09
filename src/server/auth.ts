import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { prisma } from '@/src/server/prisma';

const tokenSecret = new TextEncoder().encode(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'kapdafactory-dev-secret-change-me'
);
const TRUST_TOKEN_AUTH = process.env.KF_AUTH_TRUST_TOKEN !== 'false';

export type AuthUser = {
    id: number;
    email: string;
    name: string;
    role: string;
};

type TokenPayload = {
    sub: string;
    email: string;
    name: string;
    role: string;
};

export async function createAccessToken(user: AuthUser) {
    return new SignJWT({ email: user.email, name: user.name, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .setSubject(String(user.id))
        .sign(tokenSecret);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, tokenSecret);
        return {
            sub: String(payload.sub),
            email: String(payload.email || ''),
            name: String(payload.name || ''),
            role: String(payload.role || 'operator'),
        };
    } catch {
        return null;
    }
}

export function getTokenFromRequest(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }

    return request.cookies.get('kf_token')?.value || null;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
    const token = getTokenFromRequest(request);
    if (!token) {
        return null;
    }

    const payload = await verifyAccessToken(token);
    if (!payload?.sub) {
        return null;
    }

    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId < 1) {
        return null;
    }

    if (TRUST_TOKEN_AUTH) {
        return {
            id: userId,
            email: payload.email,
            name: payload.name || payload.email || `user-${userId}`,
            role: payload.role,
        };
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
        },
    });

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('kf_token')?.value;

    if (!token) {
        return null;
    }

    const payload = await verifyAccessToken(token);
    if (!payload?.sub) {
        return null;
    }

    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId < 1) {
        return null;
    }

    if (TRUST_TOKEN_AUTH) {
        return {
            id: userId,
            email: payload.email,
            name: payload.name || payload.email || `user-${userId}`,
            role: payload.role,
        };
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
        },
    });

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };
}
