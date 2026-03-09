import ProtectedLayout from '@/src/components/ProtectedLayout';
import OrderList from '@/src/ui-pages/OrderList';
import { getCachedOrders } from '@/src/server/orders';

export default async function DashboardPage(props: { searchParams: Promise<any> }) {
    // Auth is handled by middleware — no need for getCurrentUser() redirect here
    const searchParams = await props.searchParams;
    const data = await getCachedOrders(searchParams);

    return (
        <ProtectedLayout>
            <OrderList initialData={data} />
        </ProtectedLayout>
    );
}
