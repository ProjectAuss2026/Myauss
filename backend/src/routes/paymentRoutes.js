import { Router } from 'express';
import {
  createMembershipPaymentIntent,
  confirmMembershipPayment,
  createShirtPaymentIntent,
  confirmShirtPayment,
} from '../controllers/paymentController.js';
import { authenticateApi } from '../middleware/authMiddleware.js';

const router = Router();

// Both require a signed-in user; the membership is tied to their account.
// The Stripe webhook is mounted separately in app.js because it needs the raw
// request body for signature verification.
router.post('/payments/intent', authenticateApi, createMembershipPaymentIntent);
router.post('/payments/confirm', authenticateApi, confirmMembershipPayment);

// Standalone t-shirt purchase for an already-active member (independent of membership).
router.post('/payments/shirt-intent', authenticateApi, createShirtPaymentIntent);
router.post('/payments/shirt-confirm', authenticateApi, confirmShirtPayment);

export default router;
