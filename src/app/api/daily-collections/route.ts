import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/server/auth';
import { parseDateValue, startOfMonthUtc, toDateOnly } from '@/src/server/dates';
import { prisma } from '@/src/server/prisma';

const MAX_COLLECTION_RANGE_DAYS = 62;

function endOfUtcDay(date: Date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

export async function GET(request: NextRequest) {
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const dateFromRaw = params.get('date_from');
    const dateToRaw = params.get('date_to');
    const dateFrom = parseDateValue(dateFromRaw);
    const dateTo = parseDateValue(dateToRaw);

    if (dateFromRaw && !dateFrom) {
        return NextResponse.json({ message: 'Invalid date_from value.' }, { status: 422 });
    }
    if (dateToRaw && !dateTo) {
        return NextResponse.json({ message: 'Invalid date_to value.' }, { status: 422 });
    }

    const todayEndUtc = endOfUtcDay(new Date());
    const rangeStart = dateFrom || (dateTo ? new Date(Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), dateTo.getUTCDate() - MAX_COLLECTION_RANGE_DAYS)) : startOfMonthUtc());
    const rangeEnd = dateTo ? endOfUtcDay(dateTo) : todayEndUtc;
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();

    if (rangeMs < 0) {
        return NextResponse.json({ message: 'date_to must be on or after date_from.' }, { status: 422 });
    }

    if (dateFrom && rangeMs > MAX_COLLECTION_RANGE_DAYS * 24 * 60 * 60 * 1000) {
        return NextResponse.json(
            {
                message: `Date range is too large. Please limit to ${MAX_COLLECTION_RANGE_DAYS} days or export CSV.`,
            },
            { status: 422 }
        );
    }

    const actualDeliveryFilter = {
        not: null,
        gte: rangeStart,
        lte: rangeEnd,
    };

    const orders = await prisma.order.findMany({
        where: {
            status: 'delivered',
            actualDeliveryDate: actualDeliveryFilter,
        },
        select: {
            id: true,
            token: true,
            customerName: true,
            totalAmount: true,
            actualDeliveryDate: true,
            payments: {
                select: {
                    amount: true,
                    paymentMethod: true,
                },
            },
        },
        orderBy: {
            actualDeliveryDate: 'desc',
        },
        take: 500, // Safety limit — keeps response under Vercel's 10s timeout
    });

    const paymentMethodTotals = {
        cash: 0,
        upi: 0,
        online: 0,
    };

    for (const order of orders) {
        for (const payment of order.payments) {
            const method = (payment.paymentMethod || 'cash') as keyof typeof paymentMethodTotals;
            paymentMethodTotals[method] = (paymentMethodTotals[method] || 0) + Number(payment.amount);
        }
    }

    const grouped = new Map<string, typeof orders>();

    for (const order of orders) {
        const date = toDateOnly(order.actualDeliveryDate) || 'unknown';
        if (!grouped.has(date)) {
            grouped.set(date, []);
        }
        grouped.get(date)!.push(order);
    }

    const collections = [...grouped.entries()].map(([date, dayOrders]) => {
        const dayMethodTotals = {
            cash: 0,
            upi: 0,
            online: 0,
        };

        const mappedOrders = dayOrders.map((order: typeof orders[0]) => {
            const paidAmount = order.payments.reduce((sum: number, payment: typeof order.payments[0]) => {
                const amount = Number(payment.amount);
                const method = (payment.paymentMethod || 'cash') as keyof typeof dayMethodTotals;
                dayMethodTotals[method] += amount;
                return sum + amount;
            }, 0);

            const totalAmount = Number(order.totalAmount);

            return {
                id: order.id,
                token: order.token,
                customer_name: order.customerName,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                balance: Math.max(0, totalAmount - paidAmount),
            };
        });

        const dayTotal = mappedOrders.reduce((sum: number, order: typeof mappedOrders[0]) => sum + order.paid_amount, 0);

        return {
            date,
            total_collected: dayTotal,
            cash_total: dayMethodTotals.cash,
            upi_total: dayMethodTotals.upi,
            online_total: dayMethodTotals.online,
            orders_count: mappedOrders.length,
            orders: mappedOrders,
        };
    });

    return NextResponse.json({
        collections,
        totals: paymentMethodTotals,
    });
}
