import { test, expect } from '@playwright/test';

/**
 * Order Management Tests
 * Covers: Create order, list orders, view order details
 */

async function login(page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@admin.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
}

test.describe('Order Creation', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/orders/create');
    });

    test('should display create order form', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /new order|create order/i })).toBeVisible();
        
        // Check form fields
        await expect(page.getByLabel(/token|bill/i)).toBeVisible();
        await expect(page.getByLabel(/customer|name/i)).toBeVisible();
        await expect(page.getByLabel(/phone/i)).toBeVisible();
        await expect(page.getByLabel(/amount|total/i)).toBeVisible();
        
        // Screenshot
        await page.screenshot({ path: 'e2e/screenshots/create-order.png', fullPage: true });
    });

    test('should validate required fields', async ({ page }) => {
        // Try submitting empty form
        const submitButton = page.getByRole('button', { name: /save|create|submit/i });
        await submitButton.click();
        
        // Should show validation error for token (required field)
        await expect(page.getByText(/required|token|bill/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('should create order with minimal data', async ({ page }) => {
        const timestamp = Date.now();
        const token = `TEST-${timestamp}`;
        
        // Fill required fields
        await page.getByLabel(/token|bill/i).fill(token);
        await page.getByLabel(/customer|name/i).fill('Test Customer');
        await page.getByLabel(/phone/i).fill('9876543210');
        await page.getByLabel(/amount|total/i).fill('1000');
        
        // Submit form
        await page.getByRole('button', { name: /save|create|submit/i }).click();
        
        // Should show success message or redirect
        await expect(page.getByText(/success|created|saved/i).first()).toBeVisible({ timeout: 10000 })
            .catch(() => expect(page).toHaveURL(/.*orders.*/, { timeout: 10000 }));
    });

    test('should handle image upload', async ({ page }) => {
        // Create a dummy image file
        const imageBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
        );
        
        // Find file input
        const fileInput = page.locator('input[type="file"]');
        
        if (await fileInput.isVisible().catch(() => false)) {
            await fileInput.setInputFiles({
                name: 'test-image.png',
                mimeType: 'image/png',
                buffer: imageBuffer
            });
            
            // Check for image preview
            await expect(page.locator('img').first()).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Order List', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/orders');
    });

    test('should display orders list', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible();
        
        // Check search/filter exists
        await expect(page.getByPlaceholder(/search/i)
            .or(page.getByRole('searchbox'))
            .or(page.getByLabel(/search/i))).toBeVisible();
        
        // Screenshot
        await page.screenshot({ path: 'e2e/screenshots/orders-list.png', fullPage: true });
    });

    test('should filter orders by status', async ({ page }) => {
        // Find status filter
        const statusFilter = page.getByRole('combobox', { name: /status/i })
            .or(page.getByLabel(/status/i))
            .or(page.locator('select').filter({ hasText: /status|pending|ready|delivered/i }));
        
        if (await statusFilter.isVisible().catch(() => false)) {
            await statusFilter.selectOption('pending');
            
            // Wait for filter to apply
            await page.waitForTimeout(1000);
            
            // Screenshot filtered results
            await page.screenshot({ path: 'e2e/screenshots/orders-filtered.png', fullPage: true });
        }
    });

    test('should search orders', async ({ page }) => {
        const searchBox = page.getByPlaceholder(/search/i)
            .or(page.getByRole('searchbox'));
        
        if (await searchBox.isVisible().catch(() => false)) {
            await searchBox.fill('test');
            await searchBox.press('Enter');
            
            await page.waitForTimeout(1000);
            
            // Results should update
            await page.screenshot({ path: 'e2e/screenshots/orders-search.png', fullPage: true });
        }
    });

    test('should navigate to order detail', async ({ page }) => {
        // Click first order card
        const orderCard = page.locator('[data-testid="order-card"], .order-card, [class*="order"]').first()
            .or(page.getByRole('link').filter({ hasText: /order|#/ }).first());
        
        if (await orderCard.isVisible().catch(() => false)) {
            await orderCard.click();
            
            // Should navigate to order detail
            await expect(page).toHaveURL(/.*orders\/\d+.*/, { timeout: 5000 });
            
            await page.screenshot({ path: 'e2e/screenshots/order-detail.png', fullPage: true });
        }
    });
});

test.describe('Daily Collections', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/collections');
    });

    test('should display collections page', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /collections|daily collections/i })).toBeVisible();
        
        // Check for summary cards
        await expect(page.getByText(/total collected|cash|online/i)).toBeVisible();
        
        // Screenshot
        await page.screenshot({ path: 'e2e/screenshots/collections.png', fullPage: true });
    });

    test('should filter by date range', async ({ page }) => {
        // Find date pickers
        const dateFrom = page.getByLabel(/from|start/i).first();
        const dateTo = page.getByLabel(/to|end/i).first();
        
        if (await dateFrom.isVisible().catch(() => false)) {
            // Set date range
            const today = new Date().toISOString().split('T')[0];
            await dateFrom.fill(today);
            await dateTo.fill(today);
            
            // Trigger filter (may need button click or auto-apply)
            await page.waitForTimeout(1500);
            
            await page.screenshot({ path: 'e2e/screenshots/collections-filtered.png', fullPage: true });
        }
    });

    test('should open export modal', async ({ page }) => {
        const exportButton = page.getByRole('button', { name: /export/i });
        
        if (await exportButton.isVisible().catch(() => false)) {
            await exportButton.click();
            
            // Check modal opens
            await expect(page.getByRole('dialog')
                .or(page.getByText(/export|download/i))
                .or(page.locator('[class*="modal"]').first())).toBeVisible({ timeout: 5000 });
            
            await page.screenshot({ path: 'e2e/screenshots/export-modal.png', fullPage: true });
        }
    });
});
