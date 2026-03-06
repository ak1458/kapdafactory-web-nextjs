import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateCsrfToken, setCsrfCookie } from './lib/csrf';

// Simple in-memory store for IP-based rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 2000; // 2000 requests per minute (increased for testing)

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }

    entry.count++;
    return true;
}

export async function middleware(request: NextRequest) {
    // Skip middleware for static assets and images
    const pathname = request.nextUrl.pathname;
    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/api/storage/') ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$/)
    ) {
        return NextResponse.next();
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';

    // Check global rate limit
    if (!checkRateLimit(ip)) {
        return new NextResponse(
            JSON.stringify({ message: 'Too many requests. Please try again later.' }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': '60',
                },
            }
        );
    }

    // Get response
    const response = NextResponse.next();

    // Set CSRF token cookie if not present
    const existingCsrf = request.cookies.get('csrf_token')?.value;
    if (!existingCsrf) {
        const csrfToken = await generateCsrfToken();
        setCsrfCookie(response, csrfToken);
    }

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;
}

// Configure middleware to run on all routes except static files
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
    ],
};
