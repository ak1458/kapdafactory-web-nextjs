import { parseDateValue, toDateOnly, toIso, startOfMonthUtc } from './dates';

describe('dates utils', () => {
    describe('parseDateValue', () => {
        it('parses valid UTC date strings', () => {
            const date = parseDateValue('2026-02-21');
            expect(date).not.toBeNull();
            expect(date?.getUTCFullYear()).toBe(2026);
            expect(date?.getUTCMonth()).toBe(1); // 0-indexed, so 1 is Feb
            expect(date?.getUTCDate()).toBe(21);
        });

        it('returns null for invalid dates', () => {
            expect(parseDateValue(null)).toBeNull();
            expect(parseDateValue(undefined)).toBeNull();
            expect(parseDateValue('')).toBeNull();
            expect(parseDateValue('   ')).toBeNull();
            expect(parseDateValue('2026-14-99')).toBeNull();
            expect(parseDateValue('invalid-date')).toBeNull();
        });
    });

    describe('toDateOnly', () => {
        it('formats Date objects to YYYY-MM-DD string', () => {
            const d = new Date(Date.UTC(2026, 1, 21, 10, 30, 0));
            expect(toDateOnly(d)).toBe('2026-02-21');
        });

        it('returns null for invalid input', () => {
            expect(toDateOnly(null)).toBeNull();
            expect(toDateOnly(undefined)).toBeNull();
            expect(toDateOnly('invalid')).toBeNull();
        });
    });

    describe('toIso', () => {
        it('formats Date objects to full ISO string', () => {
            const d = new Date(Date.UTC(2026, 1, 21, 10, 30, 0));
            expect(toIso(d)).toMatch(/^2026-02-21T10:30:00\.000Z$/);
        });

        it('returns null for invalid input', () => {
            expect(toIso(null)).toBeNull();
            expect(toIso(undefined)).toBeNull();
            expect(toIso('invalid')).toBeNull();
        });
    });

    describe('startOfMonthUtc', () => {
        it('returns the first day of the current UTC month', () => {
            const d = startOfMonthUtc();
            const now = new Date();
            expect(d.getUTCFullYear()).toBe(now.getUTCFullYear());
            expect(d.getUTCMonth()).toBe(now.getUTCMonth());
            expect(d.getUTCDate()).toBe(1);
            expect(d.getUTCHours()).toBe(0);
            expect(d.getUTCMinutes()).toBe(0);
        });
    });
});
