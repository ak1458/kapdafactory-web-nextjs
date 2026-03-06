import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
    windowMs: number;
    max: number;
    keyPrefix?: string;
}

export function createRateLimit(config: RateLimitConfig) {
    const { windowMs, max, keyPrefix = '' } = config;

    return async function rateLimit(request: NextRequest): Promise<{ success: boolean; limit: number; remaining: number; resetTime: number }> {
        // Get client IP
        const ip = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
        const key = `${keyPrefix}:${ip}`;
        
        const now = Date.now();
        const entry = rateLimitStore.get(key);

        if (!entry || now > entry.resetTime) {
            // New window
            const newEntry: RateLimitEntry = {
                count: 1,
                resetTime: now + windowMs,
            };
            rateLimitStore.set(key, newEntry);
            
            // Cleanup old entries periodically
            if (rateLimitStore.size > 10000) {
                cleanupOldEntries(now);
            }
            
            return { success: true, limit: max, remaining: max - 1, resetTime: newEntry.resetTime };
        }

        if (entry.count >= max) {
            return { success: false, limit: max, remaining: 0, resetTime: entry.resetTime };
        }

        entry.count++;
        return { success: true, limit: max, remaining: max - entry.count, resetTime: entry.resetTime };
    };
}

function cleanupOldEntries(now: number) {
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

// Helper to create rate limited response
export function createRateLimitResponse(resetTime: number): NextResponse {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    return NextResponse.json(
        { 
            message: 'Too many requests. Please try again later.',
            retryAfter,
        },
        { 
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
            },
        }
    );
}
