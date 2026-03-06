import { OrderStatus, PaymentMethod } from '@prisma/client';

const orderStatuses = new Set<OrderStatus>(['pending', 'ready', 'delivered', 'transferred']);
const paymentMethods = new Set<PaymentMethod>(['cash', 'upi', 'online']);

export function parsePositiveInt(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        return null;
    }

    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseOrderStatus(value: string | null | undefined): OrderStatus | null {
    if (!value || value === 'all') {
        return null;
    }

    return orderStatuses.has(value as OrderStatus) ? (value as OrderStatus) : null;
}

export function parsePaymentMethod(value: unknown, fallback: PaymentMethod = 'cash'): PaymentMethod {
    if (typeof value !== 'string') {
        return fallback;
    }

    return paymentMethods.has(value as PaymentMethod) ? (value as PaymentMethod) : fallback;
}

// Email validation helper
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Normalize email to lowercase and trim
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}
