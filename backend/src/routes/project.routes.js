const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/my-custom', authMiddleware, projectController.getMyCustomProjects);
router.post('/custom', authMiddleware, projectController.createCustomProject);
router.delete('/custom/:projectId', authMiddleware, projectController.deleteCustomProject);

router.get('/', projectController.getProjects);
router.get('/:slug', projectController.getProjectBySlug);

module.exports = router;
