import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ConfiguredRazorpayProvider } from '../src/modules/payments/razorpay.provider';

const keySecret = 'test_secret';
const webhookSecret = 'test_webhook_secret';
const config = {
  get: (key: string) =>
    ({
      RAZORPAY_KEY_ID: 'rzp_test_public',
      RAZORPAY_KEY_SECRET: keySecret,
      RAZORPAY_WEBHOOK_SECRET: webhookSecret,
    })[key],
};

describe('ConfiguredRazorpayProvider signatures', () => {
  it('verifies payment signatures with the server secret only', () => {
    const provider = new ConfiguredRazorpayProvider(config as never);
    const signature = createHmac('sha256', keySecret).update('order_test|pay_test').digest('hex');

    expect(
      provider.verifyPaymentSignature({ orderId: 'order_test', paymentId: 'pay_test', signature }),
    ).toBe(true);
    expect(
      provider.verifyPaymentSignature({
        orderId: 'order_test',
        paymentId: 'pay_test',
        signature: 'bad',
      }),
    ).toBe(false);
    expect(provider.getPublicKeyId()).toBe('rzp_test_public');
  });

  it('verifies webhook signatures against the raw request body', () => {
    const provider = new ConfiguredRazorpayProvider(config as never);
    const body = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');

    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(Buffer.from('tampered'), signature)).toBe(false);
  });
});
