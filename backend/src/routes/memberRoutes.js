import { Router } from 'express';
import { authenticate, requireVerifiedMembership } from '../middleware/authMiddleware.js';
import { getMemberContent, getAnnouncements } from '../controllers/memberContentController.js';

const router = Router();

// GET /api/member/content — gated dashboard perks (KAN-167).
// `authenticate` rejects missing/invalid tokens with 401; `requireVerifiedMembership`
// (KAN-178, reused unchanged) rejects non-VERIFIED members with 403 and lets
// ADMIN/OWNER through. Only after both pass does the handler read members-only rows.
router.get('/member/content', authenticate, requireVerifiedMembership, getMemberContent);

// GET /api/announcements — PUBLIC dashboard announcements. No auth: announcements
// are non-sensitive club updates shown to every dashboard visitor (verified or
// not), so this preserves the pre-KAN-167 behaviour where the (then hardcoded)
// announcements rendered for all users. The handler filters to visibility=PUBLIC.
router.get('/announcements', getAnnouncements);

export default router;
