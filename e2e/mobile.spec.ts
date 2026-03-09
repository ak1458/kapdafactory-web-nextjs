import { test, expect } from '@playwright/test';

/**
 * Mobile Responsiveness Tests
 * Covers: Layout, touch targets, navigation on mobile devices
 */

async function login(page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@admin.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
}

test.describe('Mobile Responsiveness', () => {
    test.describe('iPhone 12', () => {
        test.use({ viewport: { width: 390, height: 844 } });

        test('login page should be mobile-friendly', async ({ page }) => {
            await page.goto('/login');
            
            // Check form fits in viewport
            const form = page.locator('form').first();
            const box = await form.boundingBox();
            
            expect(box.width).toBeLessThanOrEqual(390);
            
            // Check inputs are large enough for touch
            const inputs = page.locator('input');
            const count = await inputs.count();
            
            for (let i = 0; i < Math.min(count, 3); i++) {
                const inputBox = await inputs.nth(i).boundingBox();
                expect(inputBox.height).toBeGreaterThanOrEqual(44); // Minimum touch target
            }
            
            await page.screenshot({ path: 'e2e/screenshots/mobile-login.png', fullPage: true });
        });

        test('dashboard should have bottom navigation', async ({ page }) => {
            await login(page);
            
            // Check for bottom navigation
            const bottomNav = page.locator('nav[class*="bottom"], [class*="bottom-nav"]').first();
            await expect(bottomNav).toBeVisible();
            
            // Verify it's at the bottom
            const viewportHeight = 844;
            const navBox = await bottomNav.boundingBox();
            expect(navBox.y).toBeGreaterThan(viewportHeight * 0.7);
            
            await page.screenshot({ path: 'e2e/screenshots/mobile-dashboard.png', fullPage: true });
        });

        test('create order form should be scrollable', async ({ page }) => {
            await login(page);
            await page.goto('/orders/create');
            
            // Check form is accessible
            await expect(page.getByRole('heading', { name: /new order|create order/i })).toBeVisible();
            
            // Scroll to submit button
            const submitButton = page.getByRole('button', { name: /save|create|submit/i });
            await submitButton.scrollIntoViewIfNeeded();
            await expect(submitButton).toBeVisible();
            
            await page.screenshot({ path: 'e2e/screenshots/mobile-create-order.png', fullPage: true });
        });

        test('orders list should display cards properly', async ({ page }) => {
            await login(page);
            await page.goto('/orders');
            
            // Check cards fit in viewport
            const cards = page.locator('[class*="card"], [class*="order"]').first();
            if (await cards.isVisible().catch(() => false)) {
                const cardBox = await cards.boundingBox();
                expect(cardBox.width).toBeLessThanOrEqual(390);
            }
            
            await page.screenshot({ path: 'e2e/screenshots/mobile-orders-list.png', fullPage: true });
        });
    });

    test.describe('iPad', () => {
        test.use({ viewport: { width: 768, height: 1024 } });

        test('dashboard should use tablet layout', async ({ page }) => {
            await login(page);
            
            // Check stats cards layout
            const statsGrid = page.locator('[class*="grid"]').first();
            await expect(statsGrid).toBeVisible();
            
            await page.screenshot({ path: 'e2e/screenshots/tablet-dashboard.png', fullPage: true });
        });
    });
});

test.describe('Touch Interactions', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('buttons should be tappable', async ({ page }) => {
        await page.goto('/login');
        
        const loginButton = page.getByRole('button', { name: /sign in|login/i });
        const box = await loginButton.boundingBox();
        
        // Verify minimum touch target size (44x44 points)
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
    });

    test('form inputs should accept touch', async ({ page }) => {
        await page.goto('/login');
        
        const emailInput = page.getByLabel(/email/i);
        await emailInput.tap();
        await emailInput.fill('test@example.com');
        
        expect(await emailInput.inputValue()).toBe('test@example.com');
    });
});
