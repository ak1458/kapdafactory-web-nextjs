import { notFound } from 'next/navigation';
import ProtectedLayout from '@/src/components/ProtectedLayout';
import OrderDetail from '@/src/ui-pages/OrderDetail';
import { getSerializedOrderDetail } from '@/src/server/order-detail';

export default async function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
    // Auth is handled by middleware — no need for getCurrentUser() redirect here
    const params = await props.params;
    const orderId = Number(params.id);

    if (isNaN(orderId)) {
        notFound();
    }

    const order = await getSerializedOrderDetail(orderId, { mode: 'full' });

    if (!order) {
        notFound();
    }

    return (
        <ProtectedLayout>
            <OrderDetail initialOrder={order} />
        </ProtectedLayout>
    );
}
