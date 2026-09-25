import { describe, expect, it } from 'vitest';
import { formatInr, rupeesToPaise } from '../src/features/payments/money';
import { canRequestRefund, paymentStatusView } from '../src/features/payments/payment-status';

describe('formatInr', () => {
  it('formats integer paise as INR without floating point drift', () => {
    expect(formatInr(15000)).toBe('₹150');
    expect(formatInr(5000)).toBe('₹50');
    expect(formatInr(100000)).toBe('₹1,000');
    expect(formatInr(100)).toBe('₹1');
    expect(formatInr(15050)).toBe('₹150.50');
    expect(formatInr(1)).toBe('₹0.01');
  });

  it('never shows a floating point artefact for large paise values', () => {
    // en-IN lakh grouping: 12345678 paise = ₹1,23,456.78
    expect(formatInr(12345678)).toBe('₹1,23,456.78');
  });
});

describe('rupeesToPaise', () => {
  it('converts rupee input to integer paise', () => {
    expect(rupeesToPaise(150)).toBe(15000);
    expect(rupeesToPaise(1)).toBe(100);
    expect(rupeesToPaise(150.5)).toBe(15050);
  });

  it('rejects zero and negative prices', () => {
    expect(rupeesToPaise(0)).toBeNull();
    expect(rupeesToPaise(-10)).toBeNull();
    expect(rupeesToPaise(Number.NaN)).toBeNull();
  });
});

describe('paymentStatusView', () => {
  it('never describes an unconfirmed payment as successful', () => {
    expect(paymentStatusView('CREATED').label).toBe('Payment required');
    expect(paymentStatusView('PENDING').label).toBe('Payment processing');
    expect(paymentStatusView('AUTHORIZED').label).toBe('Payment verifying');
    expect(paymentStatusView('CAPTURED').label).toBe('Payment successful');
  });

  it('distinguishes pending refunds from completed refunds', () => {
    expect(paymentStatusView('REFUND_PENDING').label).toBe('Refund requested');
    expect(paymentStatusView('REFUND_PENDING').description).toContain('No money has returned yet');
    expect(paymentStatusView('REFUNDED').label).toBe('Refunded');
    expect(paymentStatusView('PARTIALLY_REFUNDED').label).toBe('Partially refunded');
  });
});

describe('canRequestRefund', () => {
  it('hides the refund action unless the server would allow it', () => {
    expect(canRequestRefund('CAPTURED', 'SCHEDULED', false)).toBe(false);
    expect(canRequestRefund('CAPTURED', 'COMPLETED', false)).toBe(false);
    expect(canRequestRefund('CAPTURED', 'CANCELLED', false)).toBe(true);
    expect(canRequestRefund('CAPTURED', 'NO_SHOW', false)).toBe(true);
  });

  it('never offers a refund for an unsettled payment', () => {
    expect(canRequestRefund('PENDING', 'CANCELLED', false)).toBe(false);
    expect(canRequestRefund('AUTHORIZED', 'CANCELLED', false)).toBe(false);
    expect(canRequestRefund('FAILED', 'CANCELLED', false)).toBe(false);
  });

  it('lets an ADMIN refund a captured payment for a live session', () => {
    expect(canRequestRefund('CAPTURED', 'SCHEDULED', true)).toBe(true);
    expect(canRequestRefund('PENDING', 'SCHEDULED', true)).toBe(false);
  });
});
