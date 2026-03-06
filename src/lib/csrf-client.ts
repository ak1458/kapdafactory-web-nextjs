// Client-side CSRF utilities
const CSRF_COOKIE_NAME = 'csrf_token';

// Get CSRF token from cookie
export function getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    return match ? match[1] : null;
}

// Set CSRF token cookie (called from server on initial load)
export function setCsrfTokenCookie(token: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; SameSite=Strict`;
}
