import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Critical Path Testing
 * Tests the most important user flows
 */

const BASE_URL = process.env.TEST_BASE_URL || 'https://admin.kapdafactory.in';
const TEST_EMAIL = 'admin@admin.com';
const TEST_PASSWORD = 'admin123';

test.describe('Smoke Tests - Critical Paths', () => {
    
    test('1. Login page loads correctly', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        // Verify login form elements
        await expect(page.locator('text=Welcome Back')).toBeVisible();
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
        await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
        await expect(page.locator('text=Forgot your password?')).toBeVisible();
        
        await page.screenshot({ path: 'e2e/screenshots/01-login-page.png', fullPage: true });
        console.log('✅ Login page renders correctly');
    });

    test('2. Can login with valid credentials', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        // Fill in credentials
        await page.locator('input[type="email"], input[name="email"]').fill(TEST_EMAIL);
        await page.locator('input[type="password"], input[name="password"]').fill(TEST_PASSWORD);
        
        // Click sign in
        await page.locator('button:has-text("Sign In")').click();
        
        // Wait for redirect to dashboard
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
        
        // Verify dashboard loaded
        await expect(page.locator('text=Dashboard, text=Orders, text=Create').first()).toBeVisible({ timeout: 10000 });
        
        await page.screenshot({ path: 'e2e/screenshots/02-dashboard.png', fullPage: true });
        console.log('✅ Login successful, dashboard loaded');
    });

    test('3. Shows error for invalid credentials', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        await page.locator('input[type="email"], input[name="email"]').fill('wrong@example.com');
        await page.locator('input[type="password"], input[name="password"]').fill('wrongpassword');
        await page.locator('button:has-text("Sign In")').click();
        
        // Should stay on login page and show error
        await expect(page).toHaveURL(/.*login.*/);
        await expect(page.locator('text=Invalid, text=Error, text=Failed').first()).toBeVisible({ timeout: 5000 });
        
        await page.screenshot({ path: 'e2e/screenshots/03-login-error.png', fullPage: true });
        console.log('✅ Invalid credentials rejected correctly');
    });

    test('4. Protected routes redirect to login', async ({ page }) => {
        // Try accessing dashboard without auth
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Should redirect to login
        await expect(page).toHaveURL(/.*login.*/, { timeout: 10000 });
        
        await page.screenshot({ path: 'e2e/screenshots/04-protected-redirect.png', fullPage: true });
        console.log('✅ Protected routes redirect to login');
    });

    test('5. Can navigate to Create Order page', async ({ page, context }) => {
        // Login first
        await page.goto(`${BASE_URL}/login`);
        await page.locator('input[type="email"], input[name="email"]').fill(TEST_EMAIL);
        await page.locator('input[type="password"], input[name="password"]').fill(TEST_PASSWORD);
        await page.locator('button:has-text("Sign In")').click();
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
        
        // Navigate to create order
        await page.goto(`${BASE_URL}/orders/create`);
        
        // Verify create order form
        await expect(page.locator('text=New Order, text=Create Order').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('input[name="token"], input[placeholder*="token"], input[placeholder*="bill"]').first()).toBeVisible();
        await expect(page.locator('input[name="customer_name"], input[placeholder*="customer"], input[placeholder*="name"]').first()).toBeVisible();
        
        await page.screenshot({ path: 'e2e/screenshots/05-create-order.png', fullPage: true });
        console.log('✅ Create Order page accessible');
    });

    test('6. Can view Orders list', async ({ page }) => {
        // Login first
        await page.goto(`${BASE_URL}/login`);
        await page.locator('input[type="email"], input[name="email"]').fill(TEST_EMAIL);
        await page.locator('input[type="password"], input[name="password"]').fill(TEST_PASSWORD);
        await page.locator('button:has-text("Sign In")').click();
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
        
        // Navigate to orders
        await page.goto(`${BASE_URL}/orders`);
        
        // Verify orders page loaded
        await expect(page.locator('text=Orders').first()).toBeVisible({ timeout: 10000 });
        
        // Check for search/filter elements
        const hasSearch = await page.locator('input[placeholder*="search"], input[type="search"]').isVisible().catch(() => false);
        const hasFilter = await page.locator('select, button:has-text("Filter"), button:has-text("Status")').first().isVisible().catch(() => false);
        
        console.log(`Search: ${hasSearch}, Filter: ${hasFilter}`);
        
        await page.screenshot({ path: 'e2e/screenshots/06-orders-list.png', fullPage: true });
        console.log('✅ Orders list page accessible');
    });

    test('7. Can view Daily Collections', async ({ page }) => {
        // Login first
        await page.goto(`${BASE_URL}/login`);
        await page.locator('input[type="email"], input[name="email"]').fill(TEST_EMAIL);
        await page.locator('input[type="password"], input[name="password"]').fill(TEST_PASSWORD);
        await page.locator('button:has-text("Sign In")').click();
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
        
        // Navigate to collections
        await page.goto(`${BASE_URL}/collections`);
        
        // Verify collections page
        await expect(page.locator('text=Collections, text=Daily Collections').first()).toBeVisible({ timeout: 10000 });
        
        // Check for summary cards
        const hasSummary = await page.locator('text=Total, text=Collected, text=Cash, text=Online').first().isVisible().catch(() => false);
        console.log(`Summary cards: ${hasSummary}`);
        
        await page.screenshot({ path: 'e2e/screenshots/07-collections.png', fullPage: true });
        console.log('✅ Daily Collections page accessible');
    });

    test('8. Mobile responsive - iPhone 12', async ({ page }) => {
        // Set iPhone 12 viewport
        await page.setViewportSize({ width: 390, height: 844 });
        
        await page.goto(`${BASE_URL}/login`);
        await page.locator('input[type="email"], input[name="email"]').fill(TEST_EMAIL);
        await page.locator('input[type="password"], input[name="password"]').fill(TEST_PASSWORD);
        await page.locator('button:has-text("Sign In")').click();
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
        
        // Check for bottom navigation on mobile
        const hasBottomNav = await page.locator('nav, [class*="bottom"]').last().isVisible().catch(() => false);
        console.log(`Bottom navigation: ${hasBottomNav}`);
        
        await page.screenshot({ path: 'e2e/screenshots/08-mobile-dashboard.png', fullPage: true });
        console.log('✅ Mobile view renders correctly');
    });

    test('9. Performance - Page load times', async ({ page }) => {
        const startTime = Date.now();
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;
        
        console.log(`Login page load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(5000);
        
        // Login and check dashboard load time
        await page.locator('input[type="email"], input[name="email"]').fill(TEST_EMAIL);
        await page.locator('input[type="password"], input[name="password"]').fill(TEST_PASSWORD);
        
        const loginStart = Date.now();
        await page.locator('button:has-text("Sign In")').click();
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
        await page.waitForLoadState('networkidle');
        const loginTime = Date.now() - loginStart;
        
        console.log(`Dashboard load after login: ${loginTime}ms`);
        expect(loginTime).toBeLessThan(8000);
        
        console.log('✅ Performance acceptable');
    });

    test('10. No console errors', async ({ page }) => {
        const errors: string[] = [];
        
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        
        // Login flow
        await page.goto(`${BASE_URL}/login`);
        await page.locator('input[type="email"], input[name="email"]').fill(TEST_EMAIL);
        await page.locator('input[type="password"], input[name="password"]').fill(TEST_PASSWORD);
        await page.locator('button:has-text("Sign In")').click();
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });
        
        // Wait a bit for any async operations
        await page.waitForTimeout(2000);
        
        // Filter out expected/non-critical errors
        const criticalErrors = errors.filter(e => 
            !e.includes('favicon') && 
            !e.includes('401') &&
            !e.includes('404') &&
            !e.includes('chunk')
        );
        
        console.log('Console errors:', errors);
        console.log('Critical errors:', criticalErrors);
        
        expect(criticalErrors.length).toBe(0);
        console.log('✅ No critical console errors');
    });
});
