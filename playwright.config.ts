import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for comprehensive E2E testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html', { open: 'never' }], ['list']],
    
    use: {
        baseURL: process.env.TEST_BASE_URL || 'https://admin.kapdafactory.in',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
        actionTimeout: 15000,
        navigationTimeout: 15000,
    },

    projects: [
        // Desktop Chrome
        {
            name: 'chromium-desktop',
            use: { ...devices['Desktop Chrome'] },
        },
        // Mobile Chrome (iPhone 12)
        {
            name: 'mobile-chrome',
            use: { ...devices['iPhone 12'] },
        },
        // Tablet (iPad)
        {
            name: 'tablet-chrome',
            use: { ...devices['iPad (gen 7)'] },
        },
    ],

    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
