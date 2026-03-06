import { parsePositiveInt, parseOrderStatus, parsePaymentMethod, isValidEmail, normalizeEmail } from './validators';
import { OrderStatus, PaymentMethod } from '@prisma/client';

describe('validators utils', () => {
    describe('parsePositiveInt', () => {
        it('parses positive integers from numbers', () => {
            expect(parsePositiveInt(10)).toBe(10);
            expect(parsePositiveInt(1)).toBe(1);
        });

        it('parses positive integers from strings', () => {
            expect(parsePositiveInt('10')).toBe(10);
            expect(parsePositiveInt('  42  ')).toBe(42);
        });

        it('returns null for invalid or non-positive integers', () => {
            expect(parsePositiveInt(0)).toBeNull();
            expect(parsePositiveInt(-5)).toBeNull();
            expect(parsePositiveInt(10.5)).toBeNull();
            expect(parsePositiveInt('0')).toBeNull();
            expect(parsePositiveInt('-5')).toBeNull();
            expect(parsePositiveInt('10.5')).toBeNull();
            expect(parsePositiveInt('abc')).toBeNull();
            expect(parsePositiveInt(null)).toBeNull();
            expect(parsePositiveInt(undefined)).toBeNull();
        });
    });

    describe('parseOrderStatus', () => {
        it('parses valid order statuses', () => {
            expect(parseOrderStatus('pending')).toBe('pending');
            expect(parseOrderStatus('ready')).toBe('ready');
            expect(parseOrderStatus('delivered')).toBe('delivered');
            expect(parseOrderStatus('transferred')).toBe('transferred');
        });

        it('returns null for invalid statuses or "all"', () => {
            expect(parseOrderStatus('all')).toBeNull();
            expect(parseOrderStatus('invalid-status')).toBeNull();
            expect(parseOrderStatus(null)).toBeNull();
            expect(parseOrderStatus(undefined)).toBeNull();
        });
    });

    describe('parsePaymentMethod', () => {
        it('parses valid payment methods', () => {
            expect(parsePaymentMethod('cash')).toBe('cash');
            expect(parsePaymentMethod('upi')).toBe('upi');
            expect(parsePaymentMethod('online')).toBe('online');
        });

        it('returns fallback for invalid payment methods', () => {
            expect(parsePaymentMethod('invalid', 'cash')).toBe('cash');
            expect(parsePaymentMethod(null, 'upi')).toBe('upi');
            expect(parsePaymentMethod(undefined, 'online')).toBe('online');
        });

        it('uses "cash" as default fallback', () => {
            expect(parsePaymentMethod('invalid')).toBe('cash');
            expect(parsePaymentMethod(null)).toBe('cash');
        });
    });

    describe('isValidEmail', () => {
        it('returns true for valid emails', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.co.in')).toBe(true);
            expect(isValidEmail('user+tag@example.com')).toBe(true);
        });

        it('returns false for invalid emails', () => {
            expect(isValidEmail('')).toBe(false);
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('@example.com')).toBe(false);
            expect(isValidEmail('user@')).toBe(false);
            expect(isValidEmail('user@.com')).toBe(false);
        });
    });

    describe('normalizeEmail', () => {
        it('converts to lowercase', () => {
            expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
        });

        it('trims whitespace', () => {
            expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
        });

        it('handles combined trim and lowercase', () => {
            expect(normalizeEmail('  Test@EXAMPLE.com  ')).toBe('test@example.com');
        });
    });
});
