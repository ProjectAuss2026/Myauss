import { Router } from 'express';
import { authenticate, requireVerifiedMembership } from '../middleware/authMiddleware.js';
import { getMemberContent } from '../controllers/memberContentController.js';

const router = Router();

// GET /api/member/content — gated dashboard perks (KAN-167).
// `authenticate` rejects missing/invalid tokens with 401; `requireVerifiedMembership`
// (KAN-178, reused unchanged) rejects non-VERIFIED members with 403 and lets
// ADMIN/OWNER through. Only after both pass does the handler read members-only rows.
router.get('/member/content', authenticate, requireVerifiedMembership, getMemberContent);

export default router;
