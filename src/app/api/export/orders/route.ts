import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/server/auth';
import { parseDateValue, toDateOnly } from '@/src/server/dates';
import { prisma } from '@/src/server/prisma';
import { toCsv } from '@/src/server/csv';
import { parseOrderStatus } from '@/src/server/validators';

const MAX_EXPORT_ROWS = 20000;
const EXPORT_FIELD_ORDER = [
    'token',
    'token_date',
    'entry_date',
    'customer',
    'delivery_date',
    'status',
    'amount',
    'payment_method',
    'remarks',
] as const;

type ExportField = (typeof EXPORT_FIELD_ORDER)[number];

function endOfUtcDay(date: Date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

function capitalize(text: string) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function parseExportFields(raw: string | null): ExportField[] {
    if (!raw || !raw.trim()) {
        return [...EXPORT_FIELD_ORDER];
    }

    const requested = new Set(
        raw
            .split(',')
            .map((field) => field.trim())
            .filter(Boolean)
    );

    return EXPORT_FIELD_ORDER.filter((field) => requested.has(field));
}

export async function GET(request: NextRequest) {
    const authUser = await getAuthUser(request);
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
    const dateFrom = parseDateValue(dateFromRaw);
    const dateTo = parseDateValue(dateToRaw);

    if (dateFromRaw && !dateFrom) {
        return NextResponse.json({ message: 'Invalid date_from value.' }, { status: 422 });
    }
    if (dateToRaw && !dateTo) {
        return NextResponse.json({ message: 'Invalid date_to value.' }, { status: 422 });
    }

    const exportFields = parseExportFields(params.get('fields'));
    if (exportFields.length === 0) {
        return NextResponse.json({ message: 'Select at least one export field.' }, { status: 422 });
    }

    const where: Prisma.OrderWhereInput = {
        ...(status ? { status } : {}),
        ...(dateFrom || dateTo
            ? {
                  createdAt: {
                      ...(dateFrom ? { gte: dateFrom } : {}),
                      ...(dateTo ? { lte: endOfUtcDay(dateTo) } : {}),
                  },
              }
            : {}),
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
            id: true,
            token: true,
            entryDate: true,
            createdAt: true,
            customerName: true,
            deliveryDate: true,
            status: true,
            totalAmount: true,
            remarks: true,
            payments: {
                select: {
                    amount: true,
                    paymentMethod: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    const header = ['Order ID'];
    if (exportFields.includes('token')) header.push('Token');
    if (exportFields.includes('token_date')) header.push('Token Date');
    if (exportFields.includes('entry_date')) header.push('Entry Date');
    if (exportFields.includes('customer')) header.push('Customer Name');
    if (exportFields.includes('delivery_date')) header.push('Delivery Date');
    if (exportFields.includes('status')) header.push('Status');
    if (exportFields.includes('amount')) header.push('Total Amount', 'Paid Amount', 'Balance');
    if (exportFields.includes('payment_method')) header.push('Payment Methods');
    if (exportFields.includes('remarks')) header.push('Remarks');

    const rows: unknown[][] = [header];

    for (const order of orders) {
        const paidAmount = order.payments.reduce((sum: number, payment: typeof order.payments[0]) => sum + Number(payment.amount), 0);
        const totalAmount = Number(order.totalAmount);
        const balance = Math.max(0, totalAmount - paidAmount);
        const tokenDate = toDateOnly(order.createdAt) || '';
        const entryDate = toDateOnly(order.entryDate) || tokenDate;

        const groupedPayments = order.payments.reduce((acc: Record<string, number>, payment: typeof order.payments[0]) => {
            const method = payment.paymentMethod || 'cash';
            acc[method] = (acc[method] || 0) + Number(payment.amount);
            return acc;
        }, {});

        const paymentMethods = Object.entries(groupedPayments)
            .map(([method, amount]) => `${capitalize(method)}: ${amount}`)
            .join(', ');

        const row: unknown[] = [order.id];
        if (exportFields.includes('token')) row.push(order.token);
        if (exportFields.includes('token_date')) row.push(tokenDate);
        if (exportFields.includes('entry_date')) row.push(entryDate);
        if (exportFields.includes('customer')) row.push(order.customerName || 'N/A');
        if (exportFields.includes('delivery_date')) row.push(toDateOnly(order.deliveryDate) || 'N/A');
        if (exportFields.includes('status')) row.push(capitalize(order.status));
        if (exportFields.includes('amount')) row.push(totalAmount, paidAmount, balance);
        if (exportFields.includes('payment_method')) row.push(paymentMethods || 'No payments');
        if (exportFields.includes('remarks')) row.push(order.remarks || '');

        rows.push(row);
    }

    const csv = toCsv(rows);
    const dateLabel = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="orders_export_${dateLabel}.csv"`,
            Pragma: 'no-cache',
            'Cache-Control': 'must-revalidate, post-check=0, pre-check=0',
            Expires: '0',
        },
    });
}
