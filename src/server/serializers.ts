import { toDateOnly, toIso } from '@/src/server/dates';

function toNumber(value: unknown) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (typeof value === 'object' && value && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
        return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value);
}

export function serializeImage(image: any) {
    // Handle both Vercel Blob URLs and local file paths
    const filename = image.filename || '';
    const isBlobUrl = filename.startsWith('http://') || filename.startsWith('https://');
    
    // For Vercel Blob, use the direct URL
    // For local files, use the storage API
    const url = isBlobUrl 
        ? filename 
        : `/api/storage/${filename.startsWith('/') ? filename.slice(1) : filename}`;
    
    return {
        id: image.id,
        order_id: image.orderId,
        filename: filename,
        mime: image.mime,
        size: image.size,
        created_at: toIso(image.createdAt),
        updated_at: toIso(image.updatedAt),
        url: url,
        is_legacy: false,
    };
}

export function serializePayment(payment: any) {
    return {
        id: payment.id,
        order_id: payment.orderId,
        amount: toNumber(payment.amount),
        payment_date: toDateOnly(payment.paymentDate),
        payment_method: payment.paymentMethod,
        note: payment.note,
        created_at: toIso(payment.createdAt),
        updated_at: toIso(payment.updatedAt),
    };
}

export function serializeLog(log: any) {
    return {
        id: log.id,
        order_id: log.orderId,
        user_id: log.userId,
        action: log.action,
        note: log.note,
        created_at: toIso(log.createdAt),
        updated_at: toIso(log.updatedAt),
        user: log.user
            ? {
                id: log.user.id,
                name: log.user.name,
                email: log.user.email,
                role: log.user.role,
            }
            : null,
    };
}

export function serializeOrder(order: any) {
    const images = Array.isArray(order.images) ? order.images.map(serializeImage) : [];
    const payments = Array.isArray(order.payments) ? order.payments.map(serializePayment) : [];
    const logs = Array.isArray(order.logs) ? order.logs.map(serializeLog) : [];

    const totalAmount = toNumber(order.totalAmount);
    const paidAmount = payments.reduce((sum: number, payment: { amount: unknown }) => {
        return sum + toNumber(payment.amount);
    }, 0);
    const balance = Math.max(0, totalAmount - paidAmount);

    return {
        id: order.id,
        token: order.token,
        bill_number: order.billNumber,
        customer_name: order.customerName,
        total_amount: totalAmount,
        measurements: order.measurements,
        delivery_date: toDateOnly(order.deliveryDate),
        entry_date: toDateOnly(order.entryDate),
        actual_delivery_date: toDateOnly(order.actualDeliveryDate),
        status: order.status,
        remarks: order.remarks,
        created_by: order.createdBy,
        created_at: toIso(order.createdAt),
        updated_at: toIso(order.updatedAt),
        paid_amount: paidAmount,
        balance,
        images,
        payments,
        logs,
    };
}

export function serializeUser(user: any) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        email_verified_at: toIso(user.emailVerifiedAt),
        created_at: toIso(user.createdAt),
        updated_at: toIso(user.updatedAt),
    };
}
