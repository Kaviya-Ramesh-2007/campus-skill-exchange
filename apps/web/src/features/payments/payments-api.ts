import type {
  CreatePaymentOrder,
  Payment,
  PaymentOrderResponse,
  RefundPayment,
  VerifyPayment,
} from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export function listPaymentHistory(): Promise<Payment[]> {
  return apiRequest<Payment[]>('/payments/history');
}

export function getPayment(paymentId: string): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export function createPaymentOrder(input: CreatePaymentOrder): Promise<PaymentOrderResponse> {
  return apiRequest<PaymentOrderResponse>('/payments/order', { method: 'POST', body: input });
}

export function verifyPayment(input: VerifyPayment): Promise<Payment> {
  return apiRequest<Payment>('/payments/verify', { method: 'POST', body: input });
}

export function requestRefund(paymentId: string, input: RefundPayment): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    body: input,
  });
}
