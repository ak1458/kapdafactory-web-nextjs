import { test, expect } from '@playwright/test';

/**
 * Dashboard Tests
 * Covers: Stats display, navigation, quick actions
 */

async function login(page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@admin.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
}

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display dashboard with stats cards', async ({ page }) => {
        // Verify dashboard heading
        await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
        
        // Check for stats cards
        await expect(page.getByText(/total orders/i)).toBeVisible();
        await expect(page.getByText(/pending/i)).toBeVisible();
        await expect(page.getByText(/ready/i)).toBeVisible();
        await expect(page.getByText(/delivered|today/i)).toBeVisible();
        
        // Screenshot
        await page.screenshot({ path: 'e2e/screenshots/dashboard.png', fullPage: true });
    });

    test('should display recent orders section', async ({ page }) => {
        // Check for recent orders heading
        await expect(page.getByText(/recent orders|latest orders/i)).toBeVisible();
        
        // Either orders are displayed or empty state
        const ordersList = page.locator('[data-testid="order-card"], .order-card, [class*="order"]').first();
        const emptyState = page.getByText(/no orders|empty/i);
        
        await expect(ordersList.or(emptyState)).toBeVisible();
    });

    test('should navigate to create order page', async ({ page }) => {
        // Find and click create order button
        const createButton = page.getByRole('button', { name: /create order|new order/i })
            .or(page.getByRole('link', { name: /create order|new order/i }));
        
        await createButton.click();
        
        await expect(page).toHaveURL(/.*orders\/(create|new).*/);
        await expect(page.getByRole('heading', { name: /new order|create order/i })).toBeVisible();
    });

    test('should navigate to orders list', async ({ page }) => {
        const viewOrdersButton = page.getByRole('button', { name: /view orders|all orders/i })
            .or(page.getByRole('link', { name: /view orders|all orders/i }));
        
        await viewOrdersButton.click();
        
        await expect(page).toHaveURL(/.*orders.*/);
    });

    test('should navigate to daily collections', async ({ page }) => {
        const collectionsButton = page.getByRole('button', { name: /collections|daily collections/i })
            .or(page.getByRole('link', { name: /collections|daily collections/i }));
        
        await collectionsButton.click();
        
        await expect(page).toHaveURL(/.*collections.*/);
    });

    test('should have working bottom navigation on mobile', async ({ page }, testInfo) => {
        // Skip if not mobile
        if (!testInfo.project.name.includes('mobile')) {
            test.skip();
        }
        
        // Check bottom nav exists
        const bottomNav = page.locator('nav[class*="bottom"], [class*="bottom-nav"]').first();
        await expect(bottomNav).toBeVisible();
        
        // Test navigation items
        const navItems = ['orders', 'create', 'collections'];
        for (const item of navItems) {
            const navLink = bottomNav.getByRole('link').filter({ hasText: new RegExp(item, 'i') })
                .or(bottomNav.locator(`[href*="${item}"]`));
            
            if (await navLink.isVisible().catch(() => false)) {
                await navLink.click();
                await expect(page).toHaveURL(new RegExp(`.*${item}.*`));
                break; // Test one navigation to avoid logout
            }
        }
    });
});
