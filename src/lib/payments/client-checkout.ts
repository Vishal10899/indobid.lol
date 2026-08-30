/**
 * Dynamic loader and modal launcher for official Razorpay Standard Checkout
 */

export interface LaunchRazorpayOptions {
  keyId?: string;
  orderId?: string;
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  listingId: string;
  bidId: string;
  listingTitle?: string;
  bidderEmail?: string;
  checkoutUrl?: string;
}

export function launchRazorpayCheckout(options: LaunchRazorpayOptions): Promise<void> {
  return new Promise((resolve) => {
    const {
      keyId,
      orderId,
      amount,
      currency = 'USD',
      name = 'indobid.lol',
      description,
      listingId,
      bidId,
      listingTitle,
      bidderEmail,
      checkoutUrl,
    } = options;

    // In local development fallback (if real Razorpay credentials are not provided)
    if (!keyId || !orderId || orderId.startsWith('order_dev_') || !keyId.startsWith('rzp_')) {
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        window.location.href = `/bid/success?session_id=${orderId || bidId}&listing_id=${listingId}&bid_id=${bidId}`;
      }
      resolve();
      return;
    }

    // Load official Razorpay checkout script dynamically
    const existingScript = document.getElementById('razorpay-checkout-js');
    const openModal = () => {
      try {
        const rzp = new (window as any).Razorpay({
          key: keyId,
          amount,
          currency,
          name: name || 'indobid.lol',
          description: description || `Verified Bid for ${listingTitle || 'Listing'}`,
          order_id: orderId,
          prefill: {
            email: bidderEmail || undefined,
          },
          notes: {
            listingId,
            bidId,
          },
          theme: {
            color: '#f59e0b', // Amber-500
          },
          handler: function (response: any) {
            // Payment success callback from Razorpay modal -> redirect to status polling
            const payId = response.razorpay_payment_id || '';
            const ordId = response.razorpay_order_id || orderId;
            window.location.href = `/bid/success?session_id=${ordId}&listing_id=${listingId}&bid_id=${bidId}&payment_id=${payId}`;
            resolve();
          },
          modal: {
            ondismiss: function () {
              // User closed/dismissed the Razorpay modal
              window.location.href = `/bid/cancelled?listing_id=${listingId}`;
              resolve();
            },
          },
        });

        rzp.on('payment.failed', function (resp: any) {
          console.error('Razorpay payment failed:', resp.error);
          window.location.href = `/bid/cancelled?listing_id=${listingId}&error=${encodeURIComponent(
            resp.error?.description || 'Payment failed'
          )}`;
          resolve();
        });

        rzp.open();
      } catch (err) {
        console.error('Error opening Razorpay modal:', err);
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          window.location.href = `/bid/cancelled?listing_id=${listingId}`;
        }
        resolve();
      }
    };

    if (existingScript && (window as any).Razorpay) {
      openModal();
    } else {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = openModal;
      script.onerror = () => {
        console.error('Failed to load Razorpay checkout.js script');
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          window.location.href = `/bid/cancelled?listing_id=${listingId}`;
        }
        resolve();
      };
      document.body.appendChild(script);
    }
  });
}
