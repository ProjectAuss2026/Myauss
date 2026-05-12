import { Router } from 'express';
import { authenticateApi, authoriseApi } from '../middleware/authMiddleware.js';
import {
  getExecutives,
  getAdminExecutives,
  createExecutive,
  updateExecutive,
  deleteExecutive,
  getExecRoles,
  createExecRole,
  deleteExecRole,
  getExecTeams,
  createExecTeam,
  deleteExecTeam,
} from '../controllers/executiveController.js';

const router = Router();

// Public
router.get('/executives', getExecutives);

// Admin — exec members
router.get('/admin/executives', authenticateApi, authoriseApi('ADMIN'), getAdminExecutives);
router.post('/admin/executives', authenticateApi, authoriseApi('ADMIN'), createExecutive);
router.put('/admin/executives/:id', authenticateApi, authoriseApi('ADMIN'), updateExecutive);
router.delete('/admin/executives/:id', authenticateApi, authoriseApi('ADMIN'), deleteExecutive);

// Admin — roles
router.get('/admin/exec-roles', authenticateApi, authoriseApi('ADMIN'), getExecRoles);
router.post('/admin/exec-roles', authenticateApi, authoriseApi('ADMIN'), createExecRole);
router.delete('/admin/exec-roles/:id', authenticateApi, authoriseApi('ADMIN'), deleteExecRole);

// Admin — teams
router.get('/admin/exec-teams', authenticateApi, authoriseApi('ADMIN'), getExecTeams);
router.post('/admin/exec-teams', authenticateApi, authoriseApi('ADMIN'), createExecTeam);
router.delete('/admin/exec-teams/:id', authenticateApi, authoriseApi('ADMIN'), deleteExecTeam);

export default router;
