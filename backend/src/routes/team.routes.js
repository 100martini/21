const express = require('express');
const router = express.Router();
const teamController = require('../controllers/team.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/', authMiddleware, teamController.createTeam);
router.post('/invite', authMiddleware, teamController.inviteToTeam);
router.get('/pending', authMiddleware, teamController.getPendingInvites);
router.patch('/:teamId/respond', authMiddleware, teamController.respondToInvite);
router.get('/my-teams', authMiddleware, teamController.getMyTeams);
router.delete('/:teamId/members/:memberId', authMiddleware, teamController.removeTeamMember);
router.delete('/:teamId', authMiddleware, teamController.deleteTeam);
router.post('/:teamId/request-delete', authMiddleware, teamController.requestDeleteTeam);
router.get('/delete-requests', authMiddleware, teamController.getDeleteRequests);
router.patch('/delete-requests/:requestId/respond', authMiddleware, teamController.respondToDeleteRequest);

module.exports = router;
