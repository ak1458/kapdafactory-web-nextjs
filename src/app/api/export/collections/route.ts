import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/server/auth';
import { parseDateValue, startOfMonthUtc, toDateOnly } from '@/src/server/dates';
import { prisma } from '@/src/server/prisma';
import { toCsv } from '@/src/server/csv';

const MAX_EXPORT_ROWS = 20000;

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

    const actualDeliveryFilter: Prisma.DateTimeNullableFilter = {
        not: null,
    };

    if (dateFrom) {
        actualDeliveryFilter.gte = dateFrom;
    }

    if (dateTo) {
        actualDeliveryFilter.lte = endOfUtcDay(dateTo);
    }

    if (!dateFrom && !dateTo) {
        actualDeliveryFilter.gte = startOfMonthUtc();
    }

    const where: Prisma.OrderWhereInput = {
        status: 'delivered',
        actualDeliveryDate: actualDeliveryFilter,
    };

    const totalRows = await prisma.order.count({ where });
    if (totalRows > MAX_EXPORT_ROWS) {
        return NextResponse.json(
            { message: `Export too large (${totalRows} rows). Please filter to ${MAX_EXPORT_ROWS} rows or fewer.` },
            { status: 422 }
        );
    }

    const orders = await prisma.order.findMany({
        where,
        select: {
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
    });

    const rows: unknown[][] = [
        ['Delivery Date', 'Token', 'Customer Name', 'Total Amount', 'Cash', 'UPI', 'Online', 'Total Paid', 'Balance'],
    ];

    let totalCash = 0;
    let totalUpi = 0;
    let totalOnline = 0;
    let grandTotal = 0;
    let totalBalance = 0;

    for (const order of orders) {
        const cash = order.payments
            .filter((payment: typeof order.payments[0]) => payment.paymentMethod === 'cash')
            .reduce((sum: number, payment: typeof order.payments[0]) => sum + Number(payment.amount), 0);
        const upi = order.payments
            .filter((payment: typeof order.payments[0]) => payment.paymentMethod === 'upi')
            .reduce((sum: number, payment: typeof order.payments[0]) => sum + Number(payment.amount), 0);
        const online = order.payments
            .filter((payment: typeof order.payments[0]) => payment.paymentMethod === 'online')
            .reduce((sum: number, payment: typeof order.payments[0]) => sum + Number(payment.amount), 0);

        const totalPaid = cash + upi + online;
        const totalAmount = Number(order.totalAmount);
        const balance = Math.max(0, totalAmount - totalPaid);

        totalCash += cash;
        totalUpi += upi;
        totalOnline += online;
        grandTotal += totalPaid;
        totalBalance += balance;

        rows.push([
            toDateOnly(order.actualDeliveryDate) || '',
            order.token,
            order.customerName || 'N/A',
            totalAmount,
            cash,
            upi,
            online,
            totalPaid,
            balance,
        ]);
    }

    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push([
        'Total',
        `${orders.length} orders`,
        '',
        orders.reduce((sum: number, order: typeof orders[0]) => sum + Number(order.totalAmount), 0),
        totalCash,
        totalUpi,
        totalOnline,
        grandTotal,
        totalBalance,
    ]);

    const csv = toCsv(rows);
    const dateLabel = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="collections_export_${dateLabel}.csv"`,
            Pragma: 'no-cache',
            'Cache-Control': 'must-revalidate, post-check=0, pre-check=0',
            Expires: '0',
        },
    });
}
