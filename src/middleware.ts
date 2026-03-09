import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/orders', '/collections'];
// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password'];

const tokenSecret = new TextEncoder().encode(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'kapdafactory-dev-secret-change-me'
);

async function isAuthenticated(request: NextRequest): Promise<boolean> {
    const token = request.cookies.get('kf_token')?.value;
    if (!token) return false;

    try {
        const { payload } = await jwtVerify(token, tokenSecret);
        return !!payload.sub;
    } catch {
        return false;
    }
}

function isProtectedRoute(pathname: string): boolean {
    return PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

function isAuthRoute(pathname: string): boolean {
    return AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Skip middleware for static assets, images, and API routes
    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/api/') ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$/)
    ) {
        return NextResponse.next();
    }

    // Auth-aware route protection
    const authed = await isAuthenticated(request);

    // Protected routes: redirect to /login if not authenticated
    if (isProtectedRoute(pathname) && !authed) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Auth routes (login, forgot-password): redirect to /dashboard if already authenticated
    if (isAuthRoute(pathname) && authed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Root path: redirect based on auth
    if (pathname === '/') {
        if (authed) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        } else {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    // Get response
    const response = NextResponse.next();

    // Add security headers (standard)
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;
}

// Configure middleware to run on all routes except static files
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
    ],
};
