import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/server/auth';
import { parseDateValue } from '@/src/server/dates';
import { getSerializedOrderDetail, invalidateOrderCache } from '@/src/server/order-detail';
import { prisma } from '@/src/server/prisma';
import { getRouteParams, getSingleParam } from '@/src/server/route-params';
import { parseOrderStatus, parsePaymentMethod, parsePositiveInt } from '@/src/server/validators';

export async function PUT(request: NextRequest, context: any) {
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });
    }

    const params = await getRouteParams(context);
    const id = parsePositiveInt(getSingleParam(params.id));
    if (!id) {
        return NextResponse.json({ message: 'Invalid order id.' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const status = typeof body?.status === 'string' ? parseOrderStatus(body.status) : null;

    if (!status) {
        return NextResponse.json({ message: 'Invalid status value.' }, { status: 422 });
    }

    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    const paymentAmount = Number(body?.payment_amount ?? 0);
    if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
        return NextResponse.json({ message: 'Payment amount must be a valid number.' }, { status: 422 });
    }

    const paymentMethod = parsePaymentMethod(body?.payment_method);

    const actualDeliveryDateRaw = String(body?.actual_delivery_date || '').trim();
    const actualDeliveryDate = parseDateValue(actualDeliveryDateRaw);
    if (actualDeliveryDateRaw && !actualDeliveryDate) {
        return NextResponse.json({ message: 'Invalid delivery date.' }, { status: 422 });
    }

    const fallbackToday = parseDateValue(new Date().toISOString().slice(0, 10));
    const resolvedDeliveryDate = status === 'delivered' ? actualDeliveryDate || fallbackToday : null;

    const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true },
    });

    if (!order) {
        return NextResponse.json({ message: 'Order not found.' }, { status: 404 });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.order.update({
            where: { id },
            data: {
                status,
                // Keep delivery date only for delivered status to avoid stale reporting.
                actualDeliveryDate: status === 'delivered' ? (resolvedDeliveryDate ?? null) : null,
            },
        });

        if (paymentAmount > 0) {
            await tx.payment.create({
                data: {
                    orderId: id,
                    amount: paymentAmount,
                    paymentDate: resolvedDeliveryDate || new Date(),
                    paymentMethod,
                    note: 'Delivery Payment',
                },
            });
        }

        const [refreshedOrder, paymentsAggregate] = await Promise.all([
            tx.order.findUniqueOrThrow({
                where: { id },
                select: {
                    totalAmount: true,
                },
            }),
            tx.payment.aggregate({
                where: { orderId: id },
                _sum: { amount: true },
            }),
        ]);

        const paid = Number(paymentsAggregate._sum.amount || 0);
        const balance = Math.max(0, Number(refreshedOrder.totalAmount) - paid);
        const paymentNote =
            status === 'delivered'
                ? balance === 0
                    ? 'Paid in full'
                    : `${balance} pending`
                : '';
        const logNote = [note, paymentNote].filter(Boolean).join('. ');

        await tx.orderLog.create({
            data: {
                orderId: id,
                action: `status_changed:${status}`,
                note: logNote || null,
                userId: authUser.id,
            },
        });
    });

    invalidateOrderCache(id);
    const updatedOrder = await getSerializedOrderDetail(id);
    if (!updatedOrder) {
        return NextResponse.json({ message: 'Order not found.' }, { status: 404 });
    }
    return NextResponse.json(updatedOrder);
}
