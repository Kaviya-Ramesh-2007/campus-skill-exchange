/**
 * Thin, typed wrapper around the real Razorpay Checkout script.
 *
 * Only the PUBLIC key returned by `POST /payments/order` is used here. The key
 * secret and webhook secret stay on the API and are never referenced by the
 * browser bundle.
 */

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const SCRIPT_ID = 'razorpay-checkout-script';

export interface RazorpayCheckoutOptions {
  /** Public key id from the API. Never the key secret. */
  key: string;
  orderId: string;
  /** Amount in INR paise, exactly as returned by the API. */
  amountPaise: number;
  currency: 'INR';
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  /** Invoked by Razorpay after the provider completes the checkout. */
  handler?: (response: unknown) => void;
}

export interface RazorpayCheckoutSuccess {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export class RazorpayUnavailableError extends Error {
  constructor(message = 'Razorpay Checkout is unavailable right now.') {
    super(message);
    this.name = 'RazorpayUnavailableError';
  }
}

export type RazorpayCheckoutResult =
  | { outcome: 'success'; payment: RazorpayCheckoutSuccess }
  | { outcome: 'cancelled' }
  | { outcome: 'failed'; reason: string };

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads the Checkout script once per page and reuses the promise afterwards. */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new RazorpayUnavailableError('Checkout requires a browser.'));
  }
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => {
        scriptPromise = null;
        reject(
          new RazorpayUnavailableError('Could not load Razorpay Checkout. Check your network.'),
        );
      },
      { once: true },
    );
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = CHECKOUT_SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
  return scriptPromise;
}

/** Test seam: lets specs simulate a successful script load. */
export function __resetRazorpayCheckoutForTests(): void {
  scriptPromise = null;
}

/**
 * Opens real Razorpay Checkout and reports what the *provider* said.
 *
 * A `success` outcome here is only a candidate result. The caller must still
 * POST it to `POST /payments/verify`; the browser result is never treated as
 * final payment confirmation on its own.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpayCheckoutResult> {
  await loadRazorpayCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) {
    scriptPromise = null;
    throw new RazorpayUnavailableError('Razorpay Checkout did not initialise.');
  }

  return new Promise<RazorpayCheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: RazorpayCheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const checkout = new Razorpay({
      ...options,
      handler: (response: unknown) => {
        const payload = response as Partial<RazorpayCheckoutSuccess>;
        if (!payload.razorpayOrderId || !payload.razorpayPaymentId || !payload.razorpaySignature) {
          finish({ outcome: 'failed', reason: 'Razorpay returned an incomplete payment result.' });
          return;
        }
        finish({
          outcome: 'success',
          payment: {
            razorpayOrderId: payload.razorpayOrderId,
            razorpayPaymentId: payload.razorpayPaymentId,
            razorpaySignature: payload.razorpaySignature,
          },
        });
      },
    });

    checkout.on('payment.failed', (payload: unknown) => {
      const detail = (payload as { error?: { description?: string } } | undefined)?.error
        ?.description;
      finish({ outcome: 'failed', reason: detail ?? 'Razorpay reported a failed payment.' });
    });
    checkout.on('payment.dismissed', () => finish({ outcome: 'cancelled' }));

    checkout.open();
  });
}
