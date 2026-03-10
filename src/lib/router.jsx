'use client';

import NextLink from 'next/link';
import {
    usePathname,
    useRouter,
    useSearchParams as useNextSearchParams,
    useParams as useNextParams,
} from 'next/navigation';
import { useMemo } from 'react';

export function Link({ to, href, children, ...props }) {
    const target = href ?? to ?? '#';
    return (
        <NextLink href={target} {...props}>
            {children}
        </NextLink>
    );
}

export function useNavigate() {
    const router = useRouter();

    return (to) => {
        if (typeof to === 'number') {
            if (typeof window !== 'undefined') {
                window.history.go(to);
            }
            return;
        }

        if (typeof to === 'string') {
            router.push(to);
            router.refresh();
        }
    };
}

export function useLocation() {
    const pathname = usePathname();
    const searchParams = useNextSearchParams();

    return useMemo(() => {
        const search = searchParams.toString();
        return {
            pathname,
            search: search ? `?${search}` : '',
        };
    }, [pathname, searchParams]);
}

export function useSearchParams() {
    const params = useNextSearchParams();
    return [params];
}

export function useParams() {
    return useNextParams();
}
