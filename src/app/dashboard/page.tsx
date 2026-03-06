import { redirect } from 'next/navigation';
import ProtectedLayout from '@/src/components/ProtectedLayout';
import OrderList from '@/src/ui-pages/OrderList';
import { getCachedOrders } from '@/src/server/orders';
import { getCurrentUser } from '@/src/server/auth';

export default async function DashboardPage(props: { searchParams: Promise<any> }) {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }

    const searchParams = await props.searchParams;
    const data = await getCachedOrders(searchParams);

    return (
        <ProtectedLayout>
            <OrderList initialData={data} />
        </ProtectedLayout>
    );
}
