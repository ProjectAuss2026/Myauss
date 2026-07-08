import { Router } from 'express';
import {
  createMembershipPaymentIntent,
  confirmMembershipPayment,
} from '../controllers/paymentController.js';
import { authenticateApi } from '../middleware/authMiddleware.js';

const router = Router();

// Both require a signed-in user; the membership is tied to their account.
// The Stripe webhook is mounted separately in app.js because it needs the raw
// request body for signature verification.
router.post('/payments/intent', authenticateApi, createMembershipPaymentIntent);
router.post('/payments/confirm', authenticateApi, confirmMembershipPayment);

export default router;
