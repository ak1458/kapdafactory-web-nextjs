
import ProtectedLayout from '@/src/components/ProtectedLayout';
import OrderList from '@/src/ui-pages/OrderList';
import { getOrders } from '@/src/server/orders';

export default async function OrdersPage(props: { searchParams: Promise<any> }) {
    // Auth is handled by middleware — no need for getCurrentUser() redirect here
    const searchParams = await props.searchParams;
    const data = await getOrders(searchParams);

    return (
        <ProtectedLayout>
            <OrderList initialData={data} />
        </ProtectedLayout>
    );
}
