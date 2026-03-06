import { prisma } from '@/src/server/prisma';
import { serializeOrder } from '@/src/server/serializers';
import { getLegacyImagesForOrder, shouldUseLegacyImageFallback } from '@/src/server/legacy-images';

type OrderDetailMode = 'full' | 'lite';
type OrderDetailOptions = {
    mode?: OrderDetailMode;
};

function parseLimitFromEnv(raw: string | undefined, fallback: number, max: number) {
    const parsed = Number.parseInt(String(raw || '').trim(), 10);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.min(parsed, max);
}

export const ORDER_DETAIL_LITE_IMAGES_LIMIT = parseLimitFromEnv(
    process.env.KF_ORDER_DETAIL_LITE_IMAGES_LIMIT,
    6,
    20
);
export const ORDER_DETAIL_IMAGES_LIMIT = parseLimitFromEnv(
    process.env.KF_ORDER_DETAIL_IMAGES_LIMIT,
    24,
    300
);
export const ORDER_DETAIL_PAYMENTS_LIMIT = parseLimitFromEnv(
    process.env.KF_ORDER_DETAIL_PAYMENTS_LIMIT,
    40,
    400
);
export const ORDER_DETAIL_LOGS_LIMIT = parseLimitFromEnv(
    process.env.KF_ORDER_DETAIL_LOGS_LIMIT,
    80,
    500
);

function clampWithTruncation<T>(items: T[], limit: number) {
    if (items.length <= limit) {
        return { items, truncated: false };
    }
    return {
        items: items.slice(0, limit),
        truncated: true,
    };
}

// Simple in-memory cache for order details (TTL: 5 seconds)
const orderCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5000;

function getCacheKey(orderId: number, mode: OrderDetailMode): string {
    return `${orderId}:${mode}`;
}

function getCachedOrder(orderId: number, mode: OrderDetailMode): any | null {
    const key = getCacheKey(orderId, mode);
    const cached = orderCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }
    if (cached) {
        orderCache.delete(key);
    }
    return null;
}

function setCachedOrder(orderId: number, mode: OrderDetailMode, data: any): void {
    const key = getCacheKey(orderId, mode);
    orderCache.set(key, { data, timestamp: Date.now() });
    
    // Cleanup old cache entries
    if (orderCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of orderCache.entries()) {
            if (now - v.timestamp > CACHE_TTL_MS) {
                orderCache.delete(k);
            }
        }
    }
}

export async function getSerializedOrderDetail(orderId: number, options: OrderDetailOptions = {}) {
    const mode: OrderDetailMode = options.mode === 'lite' ? 'lite' : 'full';
    
    // Check cache first
    const cached = getCachedOrder(orderId, mode);
    if (cached) {
        return cached;
    }
    
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true,
            token: true,
            billNumber: true,
            customerName: true,
            totalAmount: true,
            measurements: true,
            deliveryDate: true,
            entryDate: true,
            actualDeliveryDate: true,
            status: true,
            remarks: true,
            createdBy: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!order) {
        return null;
    }

    const imageLimit = mode === 'lite' ? ORDER_DETAIL_LITE_IMAGES_LIMIT : ORDER_DETAIL_IMAGES_LIMIT;

    if (mode === 'lite') {
        // In lite mode, we only need the user-facing basics fast.
        // We fetch 1 image just for a thumbnail if needed, and skip payments/logs.
        const [images] = await Promise.all([
            prisma.orderImage.findMany({
                where: { orderId },
                select: {
                    id: true,
                    orderId: true,
                    filename: true,
                    mime: true,
                    size: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 1, // Reduced from imageLimit to 1 for faster list view/initial load
            }),
        ]);

        const serialized = serializeOrder({
            ...order,
            images,
            payments: [],
            logs: [],
        }) as any;

        // Defer payment calculation for the full fetch to avoid aggregate overhead on every list item
        const totalAmount = Number(order.totalAmount);
        serialized.paid_amount = 0; // Placeholder
        serialized.balance = totalAmount; // Placeholder, client should rely on full fetch for accurate balance

        serialized.meta = {
            mode: 'lite',
            history_deferred: true,
            images_returned: images.length,
            images_truncated: true,
            payments_returned: 0,
            payments_truncated: true,
            logs_returned: 0,
            logs_truncated: true,
        };

        if (
            shouldUseLegacyImageFallback(order.id) &&
            (!Array.isArray(serialized.images) || serialized.images.length === 0)
        ) {
            serialized.images = await getLegacyImagesForOrder(order.id, 1);
        }

        // Cache the result
        setCachedOrder(orderId, mode, serialized);
        return serialized;
    }

    const [rawImages, rawPayments, rawLogs, paymentTotals] = await Promise.all([
        prisma.orderImage.findMany({
            where: { orderId },
            select: {
                id: true,
                orderId: true,
                filename: true,
                mime: true,
                size: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: ORDER_DETAIL_IMAGES_LIMIT + 1,
        }),
        prisma.payment.findMany({
            where: { orderId },
            select: {
                id: true,
                orderId: true,
                amount: true,
                paymentDate: true,
                paymentMethod: true,
                note: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
            take: ORDER_DETAIL_PAYMENTS_LIMIT + 1,
        }),
        prisma.orderLog.findMany({
            where: {
                orderId,
                action: {
                    startsWith: 'status_changed:',
                },
            },
            select: {
                id: true,
                orderId: true,
                userId: true,
                action: true,
                note: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: ORDER_DETAIL_LOGS_LIMIT + 1,
        }),
        prisma.payment.aggregate({
            where: { orderId },
            _sum: { amount: true },
        }),
    ]);

    const { items: images, truncated: imagesTruncated } = clampWithTruncation(rawImages, ORDER_DETAIL_IMAGES_LIMIT);
    const { items: payments, truncated: paymentsTruncated } = clampWithTruncation(rawPayments, ORDER_DETAIL_PAYMENTS_LIMIT);
    const { items: logs, truncated: logsTruncated } = clampWithTruncation(rawLogs, ORDER_DETAIL_LOGS_LIMIT);

    const serialized = serializeOrder({
        ...order,
        images,
        payments,
        logs,
    }) as any;
    const paidAmount = Number(paymentTotals._sum.amount || 0);
    const totalAmount = Number(order.totalAmount);

    serialized.paid_amount = paidAmount;
    serialized.balance = Math.max(0, totalAmount - paidAmount);
    serialized.meta = {
        mode: 'full',
        history_deferred: false,
        images_returned: images.length,
        images_truncated: imagesTruncated,
        payments_returned: payments.length,
        payments_truncated: paymentsTruncated,
        logs_returned: logs.length,
        logs_truncated: logsTruncated,
    };

    if (
        shouldUseLegacyImageFallback(order.id) &&
        (!Array.isArray(serialized.images) || serialized.images.length === 0)
    ) {
        serialized.images = await getLegacyImagesForOrder(order.id, Math.min(8, ORDER_DETAIL_IMAGES_LIMIT));
    }

    // Cache the result
    setCachedOrder(orderId, mode, serialized);
    return serialized;
}

// Invalidate cache for an order
export function invalidateOrderCache(orderId: number): void {
    orderCache.delete(getCacheKey(orderId, 'lite'));
    orderCache.delete(getCacheKey(orderId, 'full'));
}
