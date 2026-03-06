import { OrderStatus, Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { toDateOnly, toIso, parseDateValue } from '@/src/server/dates';
import { getLegacyImageMap, shouldUseLegacyImageFallback } from '@/src/server/legacy-images';
import { prisma } from '@/src/server/prisma';
import { serializeImage } from '@/src/server/serializers';
import { parseOrderStatus, parsePositiveInt } from '@/src/server/validators';

function endOfUtcDay(date: Date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

function nextUtcDay(date: Date) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
}

function asSortOrder(value: string | null) {
    return value === 'asc' ? 'asc' : 'desc';
}

function buildOrderFilters(
    search: string | null,
    status: OrderStatus | null,
    dateFrom: Date | null,
    dateTo: Date | null,
    exactDate: Date | null
): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (search) {
        const or: Prisma.OrderWhereInput[] = [];

        if (search.toUpperCase().startsWith('BILL-')) {
            or.push({ billNumber: { startsWith: search, mode: 'insensitive' } });
        } else if (/^\d+$/.test(search)) {
            or.push({ token: { startsWith: search } });
            or.push({ billNumber: { contains: search } });
        } else {
            or.push({ token: { contains: search, mode: 'insensitive' } });
            or.push({ billNumber: { contains: search, mode: 'insensitive' } });
            or.push({ customerName: { contains: search, mode: 'insensitive' } });
        }

        const searchDate = parseDateValue(search);
        if (searchDate) {
            or.push({
                deliveryDate: {
                    gte: searchDate,
                    lt: nextUtcDay(searchDate),
                },
            });
        }

        where.OR = or;
    }

    if (status) {
        where.status = status;
    }

    if (exactDate) {
        where.deliveryDate = {
            gte: exactDate,
            lt: nextUtcDay(exactDate),
        };
    } else if (dateFrom || dateTo) {
        where.deliveryDate = {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: endOfUtcDay(dateTo) } : {}),
        };
    }

    return where;
}

export type GetOrdersParams = {
    page?: string | number;
    per_page?: string | number;
    search?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    date?: string;
    sort_by?: string;
    sort_order?: string;
};

export async function getOrders(params: GetOrdersParams) {
    const statusRaw = params.status || 'all';
    const status = parseOrderStatus(statusRaw);

    // We ignore invalid status for safety in server calls, defaulting to all/null

    const dateFrom = parseDateValue(params.date_from);
    const dateTo = parseDateValue(params.date_to);
    const exactDate = parseDateValue(params.date);
    const search = params.search?.trim() || null;

    const where = buildOrderFilters(search, status, dateFrom, dateTo, exactDate);

    const page = parsePositiveInt(params.page) ?? 1;
    const perPage = Math.min(60, parsePositiveInt(params.per_page) ?? 15); // Default to 15 for dashboard
    const sortBy = params.sort_by || 'created_at';
    const sortOrder = asSortOrder(params.sort_order || 'desc');

    const orderBy: Prisma.OrderOrderByWithRelationInput[] =
        sortBy === 'delivery_date'
            ? [{ deliveryDate: sortOrder }, { createdAt: 'desc' }]
            : [{ createdAt: sortOrder }];

    // Run findMany + count in PARALLEL to avoid sequential waterfall
    const [fetchedOrders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            select: {
                id: true,
                token: true,
                billNumber: true,
                customerName: true,
                totalAmount: true,
                deliveryDate: true,
                entryDate: true,
                actualDeliveryDate: true,
                status: true,
                remarks: true,
                createdBy: true,
                createdAt: true,
                updatedAt: true,
                images: {
                    select: {
                        id: true,
                        orderId: true,
                        filename: true,
                        mime: true,
                        size: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 1,
                },
            },
            orderBy,
            skip: (page - 1) * perPage,
            take: perPage + 1,
        }),
        prisma.order.count({ where }),
    ]);

    const hasMore = fetchedOrders.length > perPage;
    const orders = hasMore ? fetchedOrders.slice(0, perPage) : fetchedOrders;

    const orderIds = orders.map((order: typeof orders[0]) => order.id);
    const missingImageOrderIds = orders
        .filter((order: typeof orders[0]) => order.images.length === 0 && shouldUseLegacyImageFallback(order.id))
        .map((order: typeof orders[0]) => order.id);

    const [paymentTotals, legacyImagesByOrderId] = await Promise.all([
        orderIds.length
            ? prisma.payment.groupBy({
                by: ['orderId'],
                where: {
                    orderId: {
                        in: orderIds,
                    },
                },
                _sum: {
                    amount: true,
                },
            })
            : Promise.resolve([]),
        missingImageOrderIds.length ? getLegacyImageMap(missingImageOrderIds, 1) : Promise.resolve(new Map()),
    ]);

    const paidByOrderId = new Map(paymentTotals.map((item: typeof paymentTotals[0]) => [item.orderId, Number(item._sum.amount || 0)]));

    const serializedOrders = orders.map((order: typeof orders[0]) => {
        const totalAmount = Number(order.totalAmount);
        const paidAmount = Number(paidByOrderId.get(order.id) || 0);
        const dbImages = order.images.map(serializeImage);
        const fallbackImages = legacyImagesByOrderId.get(order.id) || [];

        return {
            id: order.id,
            token: order.token,
            bill_number: order.billNumber,
            customer_name: order.customerName,
            total_amount: totalAmount,
            measurements: {},
            delivery_date: toDateOnly(order.deliveryDate),
            entry_date: toDateOnly(order.entryDate),
            actual_delivery_date: toDateOnly(order.actualDeliveryDate),
            status: order.status,
            remarks: order.remarks,
            created_by: order.createdBy,
            created_at: toIso(order.createdAt),
            updated_at: toIso(order.updatedAt),
            paid_amount: paidAmount,
            balance: Math.max(0, totalAmount - paidAmount),
            images: dbImages.length ? dbImages : fallbackImages,
            payments: [],
            logs: [],
        };
    });

    const response: Record<string, unknown> = {
        current_page: page,
        data: serializedOrders,
        from: total === 0 ? null : (page - 1) * perPage + 1,
        last_page: Math.max(1, Math.ceil(total / perPage)),
        per_page: perPage,
        to: total === 0 ? null : Math.min(page * perPage, total),
        total,
    };

    if (params.date) {
        // Run aggregates + orders in parallel
        const statsOrdersPromise = prisma.order.findMany({
            where,
            select: { id: true, totalAmount: true },
        });

        const [totalsByStatus, statsOrders] = await Promise.all([
            prisma.$transaction([
                prisma.order.aggregate({
                    where: { ...where, status: 'delivered' },
                    _sum: { totalAmount: true },
                }),
                prisma.order.aggregate({
                    where: {
                        ...where,
                        status: { notIn: ['delivered', 'transferred'] },
                    },
                    _sum: { totalAmount: true },
                }),
            ]),
            statsOrdersPromise,
        ]);

        const [totalCollectionResult, totalPendingResult] = totalsByStatus;

        const statsOrderIds = statsOrders.map((order: typeof statsOrders[0]) => order.id);
        const statsPayments = statsOrderIds.length
            ? await prisma.payment.groupBy({
                by: ['orderId'],
                where: { orderId: { in: statsOrderIds } },
                _sum: { amount: true },
            })
            : [];

        const paidByStatsOrderId = new Map(statsPayments.map((item: typeof statsPayments[0]) => [item.orderId, Number(item._sum.amount || 0)]));

        const duesCleared = statsOrders.reduce((count: number, order: typeof statsOrders[0]) => {
            const paid = Number(paidByStatsOrderId.get(order.id) || 0);
            const balance = Number(order.totalAmount) - paid;
            return balance <= 0 ? count + 1 : count;
        }, 0);

        const partialPayments = statsOrders.reduce((count: number, order: typeof statsOrders[0]) => {
            const paid = Number(paidByStatsOrderId.get(order.id) || 0);
            const balance = Number(order.totalAmount) - paid;
            return paid > 0 && balance > 0 ? count + 1 : count;
        }, 0);

        response.total_collection = Number(totalCollectionResult._sum.totalAmount || 0);
        response.total_pending = Number(totalPendingResult._sum.totalAmount || 0);
        response.total_orders = total;
        response.dues_cleared = duesCleared;
        response.partial_payments = partialPayments;
        response.full_payments = duesCleared;
    }

    return response;
}

// Cached version of getOrders for better performance
export const getCachedOrders = unstable_cache(
    async (params: GetOrdersParams) => getOrders(params),
    ['orders-list'],
    {
        revalidate: 30, // Cache for 30 seconds
        tags: ['orders'],
    }
);
