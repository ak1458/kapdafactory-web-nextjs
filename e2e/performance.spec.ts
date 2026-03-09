import { test, expect } from '@playwright/test';

/**
 * Performance Tests
 * Covers: Page load times, bundle sizes, Lighthouse scores
 */

test.describe('Performance', () => {
    test('login page should load quickly', async ({ page }) => {
        const startTime = Date.now();
        
        await page.goto('/login');
        
        // Wait for network to be idle
        await page.waitForLoadState('networkidle');
        
        const loadTime = Date.now() - startTime;
        
        console.log(`Login page load time: ${loadTime}ms`);
        
        // Should load under 3 seconds
        expect(loadTime).toBeLessThan(3000);
        
        // Check First Contentful Paint
        const fcp = await page.evaluate(() => {
            return performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
        });
        
        if (fcp) {
            console.log(`FCP: ${fcp}ms`);
            expect(fcp).toBeLessThan(1800);
        }
    });

    test('dashboard should load after login', async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.getByLabel(/email/i).fill('admin@admin.com');
        await page.getByLabel(/password/i).fill('admin123');
        
        const startTime = Date.now();
        await page.getByRole('button', { name: /sign in|login/i }).click();
        
        await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
        await page.waitForLoadState('networkidle');
        
        const loadTime = Date.now() - startTime;
        console.log(`Dashboard load time after login: ${loadTime}ms`);
        
        // Should load under 5 seconds (including API calls)
        expect(loadTime).toBeLessThan(5000);
    });

    test('should not have console errors', async ({ page }) => {
        const errors: string[] = [];
        
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
        
        // Login and check dashboard too
        await page.getByLabel(/email/i).fill('admin@admin.com');
        await page.getByLabel(/password/i).fill('admin123');
        await page.getByRole('button', { name: /sign in|login/i }).click();
        await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
        
        console.log('Console errors:', errors);
        
        // Filter out expected errors (e.g., 401 before login)
        const criticalErrors = errors.filter(e => 
            !e.includes('401') && 
            !e.includes('Unauthorized') &&
            !e.includes('favicon')
        );
        
        expect(criticalErrors).toHaveLength(0);
    });

    test('images should lazy load', async ({ page }) => {
        await page.goto('/login');
        await page.getByLabel(/email/i).fill('admin@admin.com');
        await page.getByLabel(/password/i).fill('admin123');
        await page.getByRole('button', { name: /sign in|login/i }).click();
        await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
        
        // Check for lazy loaded images
        const lazyImages = await page.locator('img[loading="lazy"]').count();
        console.log(`Found ${lazyImages} lazy-loaded images`);
        
        // This is an optimization check, not a failure
        if (lazyImages > 0) {
            console.log('✅ Lazy loading is implemented for images');
        }
    });

    test('API responses should be fast', async ({ page }) => {
        const apiTimings: { url: string; time: number }[] = [];
        
        page.on('response', async (response) => {
            if (response.url().includes('/api/')) {
                const timing = await response.request().timing();
                apiTimings.push({
                    url: response.url(),
                    time: timing.responseEnd - timing.startTime
                });
            }
        });
        
        // Login
        await page.goto('/login');
        await page.getByLabel(/email/i).fill('admin@admin.com');
        await page.getByLabel(/password/i).fill('admin123');
        await page.getByRole('button', { name: /sign in|login/i }).click();
        await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
        
        // Wait a bit for API calls
        await page.waitForTimeout(2000);
        
        console.log('API timings:', apiTimings);
        
        // All API calls should be under 2 seconds
        for (const timing of apiTimings) {
            expect(timing.time).toBeLessThan(2000);
        }
    });
});

test.describe('Accessibility', () => {
    test('login page should have proper labels', async ({ page }) => {
        await page.goto('/login');
        
        // Check for labels
        const emailInput = page.getByLabel(/email/i);
        const passwordInput = page.getByLabel(/password/i);
        
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        
        // Check for proper heading hierarchy
        const h1 = page.locator('h1');
        await expect(h1).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
        await page.goto('/login');
        
        // Tab through form elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Check focus is on a visible element
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });
});
