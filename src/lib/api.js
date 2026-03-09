'use client';

import axios from 'axios';
import { getCsrfToken } from './csrf-client';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
    timeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 15000), // Reduced from 20s
    timeoutErrorMessage: 'Request timed out. Please try again.',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true,
});

// Request interceptor with CSRF protection
api.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for mutating requests
    if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }
    }

    return config;
});

// Prevent multiple simultaneous 401 redirects
let isRedirectingToLogin = false;

// Response interceptor for auth and error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 - Unauthorized
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined' && !isRedirectingToLogin) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                if (!window.location.pathname.includes('/login')) {
                    isRedirectingToLogin = true;
                    window.location.replace('/login');
                }
            }
        }

        // Handle 429 - Rate Limited
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'] || 60;
            error.message = `Too many requests. Please try again in ${retryAfter} seconds.`;
        }

        // Handle 403 - CSRF Error
        if (error.response?.status === 403 && error.response.data?.message?.includes('CSRF')) {
            // Refresh the page to get new CSRF token
            if (typeof window !== 'undefined') {
                window.location.reload();
            }
        }

        return Promise.reject(error);
    }
);

function normalizePath(value) {
    const raw = String(value || '')
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .replace(/\\/g, '/');

    // Do not normalize away protocol slashes for absolute URLs.
    if (/^(https?:\/\/|blob:|data:)/i.test(raw)) {
        return raw;
    }

    return raw
        .replace(/^\.\/+/, '')
        .replace(/\/{2,}/g, '/')
        .replace(/^\/+/, '');
}

function addCandidate(target, value) {
    if (!value) return;
    if (!target.includes(value)) {
        target.push(value);
    }
}

function addPathVariants(target, inputPath) {
    const normalized = normalizePath(inputPath);
    if (!normalized) return;

    if (/^(https?:\/\/|blob:|data:)/i.test(normalized)) {
        addCandidate(target, normalized);
        return;
    }

    if (normalized.startsWith('api/storage/')) {
        addCandidate(target, `/${normalized}`);
        return;
    }

    const withoutPublic = normalized.replace(/^public\//i, '');
    const storageRelative = withoutPublic.replace(/^storage\//i, '');

    addCandidate(target, `/api/storage/${storageRelative}`);

    if (withoutPublic.startsWith('storage/')) {
        addCandidate(target, `/${withoutPublic}`);
        return;
    }

    if (withoutPublic.startsWith('uploads/')) {
        addCandidate(target, `/storage/${withoutPublic}`);
        addCandidate(target, `/${withoutPublic}`);
        return;
    }

    addCandidate(target, `/storage/${withoutPublic}`);
    addCandidate(target, `/${withoutPublic}`);
}

export const getStorageCandidates = (image) => {
    const candidates = [];

    if (typeof image === 'string') {
        addPathVariants(candidates, image);
        return candidates;
    }

    if (image && typeof image === 'object') {
        addPathVariants(candidates, image.url);
        addPathVariants(candidates, image.filename);
    }

    return candidates;
};

// Helper to get proper storage URL for images
export const getStorageUrl = (image) => getStorageCandidates(image)[0] || null;

// Prefetch API data for faster navigation
export const prefetchOrderData = async (orderId) => {
    try {
        await api.get(`/orders/${orderId}?lite=1`);
    } catch {
        // Silently fail prefetch
    }
};

export default api;
