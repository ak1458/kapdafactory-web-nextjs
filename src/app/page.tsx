import { redirect } from 'next/navigation';

export default function HomePage() {
    // Middleware handles auth-aware redirect (authenticated → /dashboard, unauthenticated → /login)
    // This is a fallback in case middleware doesn't catch it
    redirect('/login');
}
