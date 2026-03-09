'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);

    // Initialize auth state from localStorage on mount
    useEffect(() => {
        const initAuth = () => {
            try {
                const storedToken = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');

                if (storedToken && storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    setToken(storedToken);
                    setUser(parsedUser);
                    // Set API auth header
                    api.defaults.headers.Authorization = `Bearer ${storedToken}`;
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                // Clear invalid data
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } finally {
                setLoading(false);
                setInitialized(true);
            }
        };

        initAuth();
    }, []);

    const login = useCallback(async (email, password) => {
        try {
            const res = await api.post('/login', { email, password });
            const { access_token, user: userData } = res.data;

            if (!access_token || !userData) {
                throw new Error('Invalid response from server');
            }

            // Store in localStorage
            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(userData));

            // Update state
            setToken(access_token);
            setUser(userData);

            // Set API auth header
            api.defaults.headers.Authorization = `Bearer ${access_token}`;

            return { success: true, user: userData };
        } catch (error) {
            console.error('Login failed:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Login failed'
            };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post('/logout');
        } catch (e) {
            console.error('Logout API call failed:', e);
            // Continue with logout even if API fails
        } finally {
            // Clear localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Clear state
            setToken(null);
            setUser(null);

            // Clear API auth header
            delete api.defaults.headers.Authorization;

            toast.success('Logged out successfully');

            // Redirect to login
            if (typeof window !== 'undefined') {
                window.location.replace('/login');
            }
        }
    }, []);

    // Don't render children until auth is initialized
    if (!initialized) {
        return (
            <div className="min-h-screen bg-[#ECE5DD] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#075E54]"></div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading, initialized }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
