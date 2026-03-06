import { NextRequest, NextResponse } from 'next/server';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.AUTH_SECRET || 'csrf-secret-change-in-production';
const CSRF_COOKIE_NAME = 'csrf_token';

// Generate a random token using Web Crypto API (Edge Runtime compatible)
async function generateRandomToken(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash token using Web Crypto API (Edge Runtime compatible)
async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token + CSRF_SECRET);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate a new CSRF token
export async function generateCsrfToken(): Promise<string> {
    const token = await generateRandomToken();
    const hash = await hashToken(token);
    return `${token}.${hash}`;
}

// Validate CSRF token
export async function validateCsrfToken(token: string): Promise<boolean> {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    
    const [rawToken, hash] = parts;
    const expectedHash = await hashToken(rawToken);
    
    return hash === expectedHash;
}

// Set CSRF token cookie in response
export function setCsrfCookie(response: NextResponse, token: string): void {
    response.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
    });
}

// Get CSRF token for client-side
export function getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    return match ? match[1] : null;
}

// CSRF Protection middleware - DISABLED by default to prevent breaking existing app
// To enable CSRF protection, set ENABLE_CSRF=true in environment
export async function csrfProtection(request: NextRequest): Promise<{ valid: boolean; response?: NextResponse }> {
    // Skip if CSRF is disabled
    if (process.env.ENABLE_CSRF !== 'true') {
        return { valid: true };
    }
    
    // Skip for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        return { valid: true };
    }
    
    const headerToken = request.headers.get('x-csrf-token');
    
    if (!headerToken) {
        return {
            valid: false,
            response: NextResponse.json(
                { message: 'CSRF token missing. Please refresh the page.' },
                { status: 403 }
            ),
        };
    }
    
    if (!await validateCsrfToken(headerToken)) {
        return {
            valid: false,
            response: NextResponse.json(
                { message: 'Invalid CSRF token. Please refresh the page.' },
                { status: 403 }
            ),
        };
    }
    
    return { valid: true };
}
