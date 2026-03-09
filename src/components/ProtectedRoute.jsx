'use client';

import { useAuth } from '@/src/context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { loading, initialized } = useAuth();

    // Show loading spinner only while auth is still initializing
    if (!initialized || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#ECE5DD]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    // After initialization, always render children.
    // The middleware already verified the kf_token cookie for protected routes.
    // If the user is unauthenticated, middleware will have redirected to /login
    // before this component even mounts.
    return children;
}
