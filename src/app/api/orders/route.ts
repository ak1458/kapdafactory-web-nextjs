import { OrderStatus, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/server/auth';
import { parseDateValue, toDateOnly, toIso } from '@/src/server/dates';
import { getLegacyImageMap, shouldUseLegacyImageFallback } from '@/src/server/legacy-images';
import { storeOrderImage } from '@/src/server/files';
import { getSerializedOrderDetail, invalidateOrderCache } from '@/src/server/order-detail';
import { prisma } from '@/src/server/prisma';
import { serializeImage } from '@/src/server/serializers';
import { parseOrderStatus, parsePositiveInt } from '@/src/server/validators';
import { createRateLimit, createRateLimitResponse } from '@/src/lib/rate-limit';
import { csrfProtection } from '@/src/lib/csrf';

const MAX_IMAGES_PER_ORDER = 8;
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ENABLE_ORDER_API_PERF_LOG = process.env.KF_API_PERF_LOG === '1';

// Rate limit: 100 requests per minute per user
const ordersRateLimit = createRateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyPrefix: 'orders-api',
});

type PerfMark = {
    step: string;
    ms: number;
};

function nowMs() {
    return Number(process.hrtime.bigint()) / 1_000_000;
}

function createPerfTracker() {
    const marks: PerfMark[] = ENABLE_ORDER_API_PERF_LOG ? [{ step: 'start', ms: nowMs() }] : [];

    return {
        mark(step: string) {
            if (!ENABLE_ORDER_API_PERF_LOG) return;
            marks.push({ step, ms: nowMs() });
        },
        flush(meta: Record<string, unknown>) {
            if (!ENABLE_ORDER_API_PERF_LOG || marks.length < 2) return;

            const timings: Array<{ step: string; duration_ms: number }> = [];
            for (let i = 1; i < marks.length; i += 1) {
                timings.push({
                    step: marks[i].step,
                    duration_ms: Number((marks[i].ms - marks[i - 1].ms).toFixed(2)),
                });
            }

            console.info(
                '[api/orders][perf]',
                JSON.stringify({
                    ...meta,
                    timings,
                })
            );
        },
    };
}

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
    params: URLSearchParams,
    status: OrderStatus | null,
    dateFrom: Date | null,
    dateTo: Date | null,
    exactDate: Date | null
): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    const search = params.get('search')?.trim();

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

function addSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const perf = createPerfTracker();

    // Check rate limit
    const rateLimitResult = await ordersRateLimit(request);
    if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult.resetTime);
    }

    const authUser = await getAuthUser(request);
    perf.mark('auth');
    if (!authUser) {
        return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const statusRaw = params.get('status');
    const status = parseOrderStatus(statusRaw);
    if (statusRaw && statusRaw !== 'all' && !status) {
        return NextResponse.json({ message: 'Invalid status value.' }, { status: 422 });
    }

    const dateFromRaw = params.get('date_from');
    const dateToRaw = params.get('date_to');
    const dateRaw = params.get('date');

    const dateFrom = parseDateValue(dateFromRaw);
    const dateTo = parseDateValue(dateToRaw);
    const exactDate = parseDateValue(dateRaw);

    if (dateFromRaw && !dateFrom) {
        return NextResponse.json({ message: 'Invalid date_from value.' }, { status: 422 });
    }
    if (dateToRaw && !dateTo) {
        return NextResponse.json({ message: 'Invalid date_to value.' }, { status: 422 });
    }
    if (dateRaw && !exactDate) {
        return NextResponse.json({ message: 'Invalid date value.' }, { status: 422 });
    }

    const where = buildOrderFilters(params, status, dateFrom, dateTo, exactDate);

    const page = parsePositiveInt(params.get('page')) ?? 1;
    const perPage = Math.min(60, parsePositiveInt(params.get('per_page')) ?? 30);
    const sortBy = params.get('sort_by') || 'created_at';
    const sortOrder = asSortOrder(params.get('sort_order'));

    const orderBy: Prisma.OrderOrderByWithRelationInput[] =
        sortBy === 'delivery_date'
            ? [{ deliveryDate: sortOrder }, { createdAt: 'desc' }]
            : [{ createdAt: sortOrder }];

    try {
        // Run findMany + count in PARALLEL to avoid sequential waterfall
        const [fetchedOrders, totalCount] = await Promise.all([
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
        perf.mark('orders_query_and_count');

        const hasMore = fetchedOrders.length > perPage;
        const orders = hasMore ? fetchedOrders.slice(0, perPage) : fetchedOrders;
        const total = totalCount;

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
        perf.mark('payments_and_legacy_images');

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
                balance: Math.max(0, totalAmount - (paidAmount || 0)),
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

        if (params.get('date')) {
            // Run ALL stats queries in parallel: aggregates + orders + payments
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

        perf.mark('serialize_and_stats');
        perf.flush({
            endpoint: '/api/orders',
            total_orders: total,
            returned_count: serializedOrders.length,
            with_daily_stats: Boolean(params.get('date')),
            page,
            per_page: perPage,
        });

        const jsonResponse = NextResponse.json(response, {
            headers: {
                'Cache-Control': 's-maxage=5, stale-while-revalidate=30',
            },
        });

        return addSecurityHeaders(jsonResponse);
    } catch (error) {
        console.error('Orders GET error:', error);
        return NextResponse.json(
            { message: 'Failed to fetch orders.' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    // Check rate limit
    const rateLimitResult = await ordersRateLimit(request);
    if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult.resetTime);
    }

    // Check CSRF token
    const csrfResult = await csrfProtection(request);
    if (!csrfResult.valid) {
        return csrfResult.response!;
    }

    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });
    }

    try {
        const formData = await request.formData();

        const tokenInput = String(formData.get('token') || '').trim();
        const billNumberInput = String(formData.get('bill_number') || '').trim();
        const orderNumber = tokenInput || billNumberInput;
        if (!orderNumber) {
            return NextResponse.json({ message: 'Bill / Token number is required.' }, { status: 422 });
        }
        if (tokenInput && billNumberInput && tokenInput !== billNumberInput) {
            return NextResponse.json({ message: 'Bill / Token values must match.' }, { status: 422 });
        }

        const token = orderNumber;
        const billNumber = orderNumber;
        const customerName = String(formData.get('customer_name') || '').trim() || null;
        const deliveryDateRaw = String(formData.get('delivery_date') || '').trim();
        const deliveryDate = parseDateValue(deliveryDateRaw);
        if (deliveryDateRaw && !deliveryDate) {
            return NextResponse.json({ message: 'Invalid delivery date.' }, { status: 422 });
        }

        const entryDateRaw = String(formData.get('entry_date') || '').trim();
        const parsedEntryDate = parseDateValue(entryDateRaw);
        if (entryDateRaw && !parsedEntryDate) {
            return NextResponse.json({ message: 'Invalid entry date.' }, { status: 422 });
        }
        const entryDate = parsedEntryDate || parseDateValue(new Date().toISOString().slice(0, 10));

        const remarks = String(formData.get('remarks') || '').trim() || null;
        const totalAmountRaw = String(formData.get('total_amount') || '').trim();
        if (!totalAmountRaw) {
            return NextResponse.json({ message: 'Total amount is required.' }, { status: 422 });
        }
        const totalAmountValue = Number(totalAmountRaw);
        if (!Number.isFinite(totalAmountValue) || totalAmountValue <= 0) {
            return NextResponse.json({ message: 'Total amount must be greater than 0.' }, { status: 422 });
        }
        const totalAmount = totalAmountValue;

        const measurementsRaw = formData.get('measurements');
        let measurements: Prisma.InputJsonValue = {};
        if (typeof measurementsRaw === 'string' && measurementsRaw.trim()) {
            try {
                measurements = JSON.parse(measurementsRaw);
            } catch (e) {
                console.warn('Failed to parse measurements JSON:', e);
                measurements = {};
            }
        }

        const files = [...formData.getAll('images[]'), ...formData.getAll('images')].filter(
            (item): item is File => item instanceof File && item.size > 0
        );

        if (files.length > MAX_IMAGES_PER_ORDER) {
            return NextResponse.json(
                { message: `Maximum ${MAX_IMAGES_PER_ORDER} images are allowed per order.` },
                { status: 422 }
            );
        }

        const invalidType = files.find((file) => !file.type.startsWith('image/'));
        if (invalidType) {
            return NextResponse.json({ message: `Unsupported file type: ${invalidType.name}.` }, { status: 422 });
        }

        const tooLarge = files.find((file) => file.size > MAX_IMAGE_SIZE_BYTES);
        if (tooLarge) {
            return NextResponse.json({ message: `File ${tooLarge.name} is too large.` }, { status: 422 });
        }

        // Create order first (without transaction for better error handling)
        const newOrder = await prisma.order.create({
            data: {
                token,
                billNumber,
                customerName,
                deliveryDate,
                entryDate,
                measurements,
                remarks,
                status: 'pending',
                createdBy: authUser.id,
                totalAmount,
            },
        });

        // Upload images after order creation (outside transaction)
        if (files.length > 0) {
            try {
                await Promise.all(
                    files.map(async (file) => {
                        const path = await storeOrderImage(newOrder.id, file);
                        return prisma.orderImage.create({
                            data: {
                                orderId: newOrder.id,
                                filename: path,
                                mime: file.type || null,
                                size: file.size,
                            },
                        });
                    })
                );
            } catch (imageError) {
                console.error('Image upload error:', imageError);
                // Don't fail the order creation if images fail
            }
        }

        // Create order log entry
        await prisma.orderLog.create({
            data: {
                orderId: newOrder.id,
                action: 'created',
                note: 'Order created',
                userId: authUser.id,
            },
        });

        // Fetch serialized order details (consistent with all other endpoints)
        invalidateOrderCache(newOrder.id);
        const createdOrder = await getSerializedOrderDetail(newOrder.id);
        if (!createdOrder) {
            return NextResponse.json({ message: 'Order created but failed to fetch details.' }, { status: 201 });
        }

        const response = NextResponse.json(createdOrder, { status: 201 });
        return addSecurityHeaders(response);
    } catch (error: any) {
        console.error('Order creation error:', error);
        if (error?.code === 'P2002') {
            return NextResponse.json({ message: 'Bill / Token number already exists.' }, { status: 422 });
        }
        return NextResponse.json({ message: 'Failed to create order: ' + (error?.message || 'Unknown error') }, { status: 500 });
    }
}
