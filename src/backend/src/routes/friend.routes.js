const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friend.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', authMiddleware, friendController.getFriends);
router.get('/pending', authMiddleware, friendController.getPendingRequests);
router.get('/search', authMiddleware, friendController.searchFriends);
router.get('/search-users', authMiddleware, friendController.searchUsers);
router.post('/request', authMiddleware, friendController.sendRequest);
router.patch('/:friendshipId/respond', authMiddleware, friendController.respondToRequest);
router.delete('/:friendshipId', authMiddleware, friendController.removeFriend);

module.exports = router;
