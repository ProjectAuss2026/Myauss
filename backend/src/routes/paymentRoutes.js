import { Router } from 'express';
import { createMembershipPaymentIntent } from '../controllers/paymentController.js';

const router = Router();

router.post('/payments/intent', createMembershipPaymentIntent);

export default router;
