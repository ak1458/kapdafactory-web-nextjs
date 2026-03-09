import { test, expect } from '@playwright/test';

/**
 * Authentication Flow Tests
 * Covers: Login, Logout, Protected Routes, Session Management
 */

test.describe('Authentication Flow', () => {
    
    test.describe('Login Page', () => {
        test('should display login form correctly', async ({ page }) => {
            await page.goto('/login');
            
            // Check page title/header
            await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
            
            // Check form elements exist
            await expect(page.getByLabel(/email/i)).toBeVisible();
            await expect(page.getByLabel(/password/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
            
            // Check forgot password link
            await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
            
            // Screenshot for verification
            await page.screenshot({ path: 'e2e/screenshots/login-page.png', fullPage: true });
        });

        test('should show error for invalid credentials', async ({ page }) => {
            await page.goto('/login');
            
            // Fill invalid credentials
            await page.getByLabel(/email/i).fill('invalid@example.com');
            await page.getByLabel(/password/i).fill('wrongpassword');
            await page.getByRole('button', { name: /sign in|login/i }).click();
            
            // Check for error message
            await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 5000 });
            
            // Should stay on login page
            await expect(page).toHaveURL(/.*login.*/);
        });

        test('should login successfully with valid credentials', async ({ page }) => {
            await page.goto('/login');
            
            // Fill valid credentials (using mock data)
            await page.getByLabel(/email/i).fill('admin@admin.com');
            await page.getByLabel(/password/i).fill('admin123');
            
            // Click login
            await page.getByRole('button', { name: /sign in|login/i }).click();
            
            // Should redirect to dashboard
            await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
            
            // Verify dashboard content loaded
            await expect(page.getByText(/dashboard|orders|welcome/i)).toBeVisible();
            
            // Verify cookie is set
            const cookies = await page.context().cookies();
            const authCookie = cookies.find(c => c.name === 'kf_token');
            expect(authCookie).toBeTruthy();
        });

        test('should navigate to forgot password page', async ({ page }) => {
            await page.goto('/login');
            
            await page.getByRole('link', { name: /forgot password/i }).click();
            
            await expect(page).toHaveURL(/.*forgot-password.*/);
            await expect(page.getByRole('heading', { name: /forgot password|reset password/i })).toBeVisible();
        });
    });

    test.describe('Protected Routes', () => {
        test('should redirect unauthenticated users to login', async ({ page }) => {
            // Try accessing dashboard without login
            await page.goto('/dashboard');
            
            // Should redirect to login
            await expect(page).toHaveURL(/.*login.*/, { timeout: 5000 });
        });

        test('should redirect unauthenticated users from orders page', async ({ page }) => {
            await page.goto('/orders');
            await expect(page).toHaveURL(/.*login.*/, { timeout: 5000 });
        });

        test('should redirect unauthenticated users from collections page', async ({ page }) => {
            await page.goto('/collections');
            await expect(page).toHaveURL(/.*login.*/, { timeout: 5000 });
        });

        test('should redirect authenticated users away from login page', async ({ page }) => {
            // First login
            await page.goto('/login');
            await page.getByLabel(/email/i).fill('admin@admin.com');
            await page.getByLabel(/password/i).fill('admin123');
            await page.getByRole('button', { name: /sign in|login/i }).click();
            await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
            
            // Try to access login again
            await page.goto('/login');
            
            // Should redirect to dashboard
            await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 5000 });
        });
    });

    test.describe('Logout', () => {
        test('should logout and clear session', async ({ page }) => {
            // Login first
            await page.goto('/login');
            await page.getByLabel(/email/i).fill('admin@admin.com');
            await page.getByLabel(/password/i).fill('admin123');
            await page.getByRole('button', { name: /sign in|login/i }).click();
            await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
            
            // Verify logged in
            const cookiesBefore = await page.context().cookies();
            expect(cookiesBefore.find(c => c.name === 'kf_token')).toBeTruthy();
            
            // Click logout (adjust selector based on your UI)
            const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
            if (await logoutButton.isVisible().catch(() => false)) {
                await logoutButton.click();
            } else {
                // Try finding in menu/nav
                await page.getByRole('navigation').getByText(/logout|sign out/i).click();
            }
            
            // Should redirect to login
            await expect(page).toHaveURL(/.*login.*/, { timeout: 5000 });
            
            // Verify cookie cleared
            const cookiesAfter = await page.context().cookies();
            expect(cookiesAfter.find(c => c.name === 'kf_token')).toBeFalsy();
        });
    });
});
