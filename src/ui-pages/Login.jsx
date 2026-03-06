'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
    const router = useRouter();
    const { login, user, loading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Redirect if already logged in
    useEffect(() => {
        if (user && !authLoading) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 5) {
            newErrors.password = 'Password must be at least 5 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [email, password]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        const trimmedEmail = email.trim().toLowerCase();

        try {
            const result = await login(trimmedEmail, password);

            if (result.success) {
                toast.success('Login successful!');
                router.replace('/dashboard');
            } else {
                toast.error(result.message || 'Login failed');
                setErrors({ form: result.message || 'Invalid credentials' });
            }
        } catch (error) {
            console.error('Login error:', error);
            toast.error('An unexpected error occurred');
            setErrors({ form: 'An unexpected error occurred' });
        } finally {
            setIsLoading(false);
        }
    }, [email, password, login, router, validateForm]);

    const handleEmailChange = useCallback((e) => {
        setEmail(e.target.value);
        if (errors.email) {
            setErrors(prev => ({ ...prev, email: undefined }));
        }
    }, [errors.email]);

    const handlePasswordChange = useCallback((e) => {
        setPassword(e.target.value);
        if (errors.password) {
            setErrors(prev => ({ ...prev, password: undefined }));
        }
    }, [errors.password]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#ECE5DD] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#075E54]"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#ECE5DD] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-[#075E54] p-6 text-white">
                    <h1 className="text-2xl font-bold">Welcome Back</h1>
                    <p className="text-sm opacity-80 mt-1">Sign in to manage your orders</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {errors.form && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                            {errors.form}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={handleEmailChange}
                            className={`w-full px-4 py-3 rounded-lg border ${errors.email ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-[#075E54] focus:border-transparent transition-all`}
                            placeholder="admin@admin.com"
                            autoComplete="email"
                            disabled={isLoading}
                        />
                        {errors.email && (
                            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={handlePasswordChange}
                            className={`w-full px-4 py-3 rounded-lg border ${errors.password ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-[#075E54] focus:border-transparent transition-all`}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            disabled={isLoading}
                        />
                        {errors.password && (
                            <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#075E54] hover:bg-[#128C7E] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>

                    <div className="text-center text-sm text-gray-500 mt-4">
                        <a href="/forgot-password" className="text-[#075E54] hover:underline">
                            Forgot your password?
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
