import { PrismaClient } from '@prisma/client';
import { mockUsers, mockOrders, mockOrderImages, mockPayments, mockOrderLogs } from './mock-data';

declare global {
    var __prisma__: PrismaClient | undefined;
}

// Check if we should use mock data FIRST, before any database logic
const useMockData = (process.env.USE_MOCK_DATA || '').trim() === 'true';

function normalizeDatabaseUrl() {
    const configured = (process.env.DATABASE_URL || '').trim();
    const prismaUrl = (process.env.POSTGRES_PRISMA_URL || '').trim();
    const fallback = (process.env.POSTGRES_URL || '').trim();

    let resolved = configured || prismaUrl || fallback;

    if (resolved.includes('${POSTGRES_PRISMA_URL}') && prismaUrl) {
        resolved = resolved.replaceAll('${POSTGRES_PRISMA_URL}', prismaUrl);
    }
    if (resolved.includes('${POSTGRES_URL}')) {
        const replacement = prismaUrl || fallback;
        if (replacement) {
            resolved = resolved.replaceAll('${POSTGRES_URL}', replacement);
        }
    }

    if (!resolved) {
        return null;
    }

    try {
        const parsed = new URL(resolved);
        const hostname = parsed.hostname.toLowerCase();
        const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
        const isSupabasePooler = hostname.endsWith('.pooler.supabase.com');

        // Local Postgres commonly runs without TLS; forcing disable avoids handshake failures.
        if (isLocalHost && process.env.LOCAL_DB_SSL !== 'true') {
            parsed.searchParams.set('sslmode', 'disable');
        }

        // Supabase pooled endpoints require PgBouncer-safe mode for Prisma.
        if (isSupabasePooler && !parsed.searchParams.has('pgbouncer')) {
            parsed.searchParams.set('pgbouncer', 'true');
        }

        // Optimized connection settings for serverless
        if (!parsed.searchParams.has('connection_limit')) {
            parsed.searchParams.set('connection_limit', '10');
        }

        return parsed.toString();
    } catch {
        return resolved;
    }
}

const normalizedUrl = normalizeDatabaseUrl();
if (normalizedUrl && !useMockData) {
    process.env.DATABASE_URL = normalizedUrl;
}

// Initialize Prisma Client
function createPrismaClient(): PrismaClient {
    // Use mock data if explicitly enabled
    if (useMockData) {
        console.log('[prisma] Using MOCK DATA for testing');

        // Create a comprehensive mock Prisma client
        return new Proxy({} as PrismaClient, {
            get: function (target, prop: string) {
                // Handle $queryRaw
                if (prop === '$queryRaw') {
                    return async () => [{ '1': 1 }];
                }

                // Handle $transaction
                if (prop === '$transaction') {
                    return async (queries: any[]) => Promise.all(queries);
                }

                // Handle $connect, $disconnect
                if (prop === '$connect' || prop === '$disconnect') {
                    return async () => { };
                }

                // Handle $queryRawUnsafe
                if (prop === '$queryRawUnsafe') {
                    return async () => [{ '1': 1 }];
                }

                // Handle $extends
                if (prop === '$extends') {
                    return () => target;
                }

                // Return model-specific handlers
                return createMockModelHandler(prop as string);
            }
        }) as PrismaClient;
    }

    // Real Prisma Client
    console.log('[prisma] Using REAL DATABASE connection');
    const client = new PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    });

    return client;
}

// Create mock handlers for each Prisma model
function createMockModelHandler(modelName: string) {
    const handlers: Record<string, any> = {
        user: {
            findMany: async () => mockUsers,
            findFirst: async ({ where }: any) => mockUsers.find(u =>
                (where?.email && u.email === where.email) ||
                (where?.id && u.id === where.id)
            ) || null,
            findUnique: async ({ where }: any) => mockUsers.find(u =>
                (where?.email && u.email === where.email) ||
                (where?.id && u.id === where.id)
            ) || null,
            count: async () => mockUsers.length,
            create: async ({ data }: any) => ({ ...data, id: mockUsers.length + 1, createdAt: new Date(), updatedAt: new Date() }),
            update: async ({ where, data }: any) => {
                const user = mockUsers.find(u => u.id === where.id);
                return user ? { ...user, ...data } : null;
            },
            upsert: async ({ create }: any) => ({ ...create, id: 1, createdAt: new Date(), updatedAt: new Date() }),
            deleteMany: async () => ({ count: 0 }),
        },
        order: {
            findMany: async ({ where, skip, take, orderBy, include, select }: any = {}) => {
                let results = [...mockOrders];

                // Apply filters
                if (where?.status) {
                    results = results.filter(o => o.status === where.status);
                }
                if (where?.actualDeliveryDate) {
                    // Filter by delivery date range
                    results = results.filter(o => o.actualDeliveryDate);
                }
                if (where?.OR) {
                    // Simple search implementation
                    results = results.filter(o =>
                        o.customerName?.toLowerCase().includes(where.OR[0].customerName?.contains?.toLowerCase() || '') ||
                        o.token?.toLowerCase().includes(where.OR[0].token?.contains?.toLowerCase() || '') ||
                        o.billNumber?.toLowerCase().includes(where.OR[0].billNumber?.contains?.toLowerCase() || '')
                    );
                }

                // Return with relations
                return results.slice(skip || 0, (skip || 0) + (take || 100)).map(o => ({
                    ...o,
                    images: o.images || [],
                    payments: o.payments || [],
                    logs: [],
                }));
            },
            findFirst: async ({ where }: any) => mockOrders.find(o =>
                (where?.id && o.id === where.id) ||
                (where?.token && o.token === where.token) ||
                (where?.billNumber && o.billNumber === where.billNumber)
            ) || null,
            findUnique: async ({ where, include, select }: any) => {
                const order = mockOrders.find(o =>
                    (where?.id && o.id === where.id) ||
                    (where?.token && o.token === where.token)
                );
                if (!order) return null;
                // Return order with relations if requested
                return {
                    ...order,
                    images: order.images || [],
                    payments: order.payments || [],
                    logs: [],
                };
            },
            count: async ({ where }: any = {}) => {
                let results = [...mockOrders];
                if (where?.status) {
                    results = results.filter(o => o.status === where.status);
                }
                return results.length;
            },
            create: async ({ data }: any) => ({ ...data, id: mockOrders.length + 1, createdAt: new Date(), updatedAt: new Date() }),
            update: async ({ where, data }: any) => {
                const order = mockOrders.find(o => o.id === where.id);
                return order ? { ...order, ...data } : null;
            },
            aggregate: async ({ where, _sum }: any = {}) => {
                let results = [...mockOrders];
                if (where?.status) {
                    results = results.filter(o => o.status === where.status);
                }
                const sum = results.reduce((acc, o) => acc + Number(o.totalAmount), 0);
                return { _sum: { totalAmount: sum } };
            },
        },
        orderImage: {
            findMany: async ({ where }: any = {}) => {
                if (where?.orderId) {
                    return mockOrderImages.filter(i => i.orderId === where.orderId);
                }
                return mockOrderImages;
            },
            create: async ({ data }: any) => ({ ...data, id: mockOrderImages.length + 1, createdAt: new Date(), updatedAt: new Date() }),
            delete: async () => ({ id: 1 }),
        },
        payment: {
            findMany: async ({ where }: any = {}) => {
                let results = [...mockPayments];
                if (where?.orderId) {
                    results = results.filter(p => p.orderId === where.orderId);
                }
                return results;
            },
            groupBy: async ({ by, where }: any = {}) => {
                const results: Record<number, number> = {};
                mockPayments.forEach(p => {
                    if (!where?.orderId?.in || where.orderId.in.includes(p.orderId)) {
                        results[p.orderId] = (results[p.orderId] || 0) + Number(p.amount);
                    }
                });
                return Object.entries(results).map(([orderId, amount]) => ({
                    orderId: Number(orderId),
                    _sum: { amount }
                }));
            },
            create: async ({ data }: any) => ({ ...data, id: mockPayments.length + 1, createdAt: new Date(), updatedAt: new Date() }),
            aggregate: async ({ where, _sum }: any = {}) => {
                let results = [...mockPayments];
                if (where?.orderId) {
                    results = results.filter(p => p.orderId === where.orderId);
                }
                const sum = results.reduce((acc, p) => acc + Number(p.amount), 0);
                return { _sum: { amount: sum } };
            },
        },
        orderLog: {
            findMany: async ({ where }: any = {}) => {
                let results = [...mockOrderLogs];
                if (where?.orderId) {
                    results = results.filter(l => l.orderId === where.orderId);
                }
                return results;
            },
            create: async ({ data }: any) => ({ ...data, id: mockOrderLogs.length + 1, createdAt: new Date(), updatedAt: new Date() }),
        },
        passwordReset: {
            findUnique: async () => null,
            upsert: async () => ({ email: 'test@test.com', token: 'token', createdAt: new Date() }),
            delete: async () => ({ email: 'test@test.com' }),
        },
    };

    // Return default handler if model not found
    return handlers[modelName] || {
        findMany: async () => [],
        findFirst: async () => null,
        findUnique: async () => null,
        count: async () => 0,
        create: async ({ data }: any) => ({ ...data, id: 1 }),
        update: async () => ({ id: 1 }),
        upsert: async ({ create }: any) => ({ ...create, id: 1 }),
        delete: async () => ({ id: 1 }),
        deleteMany: async () => ({ count: 0 }),
        aggregate: async () => ({ _sum: {} }),
    };
}

export const prisma = globalThis.__prisma__ || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma__ = prisma;
}
