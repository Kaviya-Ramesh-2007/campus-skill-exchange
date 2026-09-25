import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const RAZORPAY_PROVIDER = Symbol('RAZORPAY_PROVIDER');

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
}

export interface RazorpayRefundResult {
  id: string;
  status: string;
}

export interface RazorpayProvider {
  createOrder(input: { paymentId: string; amountPaise: number }): Promise<RazorpayOrderResult>;
  verifyPaymentSignature(input: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  createRefund(input: { paymentId: string; amountPaise: number }): Promise<RazorpayRefundResult>;
  getPublicKeyId(): string;
}

export class RazorpayProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RazorpayProviderError';
  }
}

@Injectable()
export class ConfiguredRazorpayProvider implements RazorpayProvider {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.keyId = config.get<string>('RAZORPAY_KEY_ID') ?? '';
    this.keySecret = config.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.webhookSecret = config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
  }

  getPublicKeyId(): string {
    this.requireConfigured();
    return this.keyId;
  }

  async createOrder(input: {
    paymentId: string;
    amountPaise: number;
  }): Promise<RazorpayOrderResult> {
    this.requireConfigured();
    const response = await this.request('/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: 'INR',
        receipt: input.paymentId,
        notes: { paymentId: input.paymentId },
      }),
    });
    const body = (await response.json()) as { id?: string; amount?: number; currency?: string };
    if (!body.id || body.amount !== input.amountPaise || body.currency !== 'INR') {
      throw new RazorpayProviderError('Razorpay returned an invalid order.');
    }
    return { id: body.id, amount: body.amount, currency: body.currency };
  }

  verifyPaymentSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    return this.matches(this.signature(`${input.orderId}|${input.paymentId}`), input.signature);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return this.matches(this.signature(rawBody.toString('utf8'), this.webhookSecret), signature);
  }

  async createRefund(input: {
    paymentId: string;
    amountPaise: number;
  }): Promise<RazorpayRefundResult> {
    this.requireConfigured();
    const response = await this.request(
      `/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
      {
        method: 'POST',
        body: JSON.stringify({ amount: input.amountPaise }),
      },
    );
    const body = (await response.json()) as { id?: string; status?: string };
    if (!body.id || !body.status)
      throw new RazorpayProviderError('Razorpay returned an invalid refund.');
    return { id: body.id, status: body.status };
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`https://api.razorpay.com${path}`, {
        ...init,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new RazorpayProviderError('Razorpay is unavailable.');
    }
    if (!response.ok) {
      throw new RazorpayProviderError('Razorpay rejected the request.');
    }
    return response;
  }

  private signature(value: string, secret = this.keySecret): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private matches(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(actual, 'utf8');
    return (
      expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }

  private requireConfigured(): void {
    if (!this.keyId || !this.keySecret || !this.webhookSecret) {
      throw new RazorpayProviderError('Razorpay is not configured.');
    }
  }
}
