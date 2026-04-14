const prisma = require('../prisma');

const profileSelect = {
  id: true,
  intraId: true,
  login: true,
  displayName: true,
  email: true,
  avatar: true,
  nickname: true,
  customAvatar: true,
  bio: true,
  campus: true,
  level: true,
  wallet: true,
  correctionPoints: true,
  curriculum: true,
  grade: true,
  currentCircle: true,
  createdAt: true,
};

const profileController = {
  async getProfile(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: profileSelect
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  },

  async updateProfile(req, res) {
    try {
      const updateData = {};

      if (req.body.nickname !== undefined) {
        const { nickname } = req.body;

        if (nickname === '') {
          updateData.nickname = null;
        } else {
          const trimmed = nickname.trim();

          if (trimmed.length > 20) {
            return res.status(400).json({ error: 'Nickname must be 20 characters or less' });
          }
          if (trimmed.length < 2) {
            return res.status(400).json({ error: 'Nickname must be at least 2 characters' });
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            return res.status(400).json({ error: 'Nickname can only contain letters, numbers, underscores and hyphens' });
          }

          const existing = await prisma.user.findFirst({
            where: {
              nickname: { equals: trimmed, mode: 'insensitive' },
              id: { not: req.userId }
            }
          });
          if (existing) {
            return res.status(400).json({ error: 'Nickname is already taken' });
          }

          updateData.nickname = trimmed;
        }
      }

      if (req.body.bio !== undefined) {
        const { bio } = req.body;

        if (bio === '' || bio === null) {
          updateData.bio = null;
        } else {
          const trimmed = bio.trim();

          if (trimmed.length > 160) {
            return res.status(400).json({ error: 'Bio must be 160 characters or less' });
          }

          updateData.bio = trimmed;
        }
      }

      if (req.body.customAvatar !== undefined) {
        if (req.body.customAvatar === null || req.body.customAvatar === '') {
          updateData.customAvatar = null;
        } else {
          const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
          if (!base64Regex.test(req.body.customAvatar)) {
            return res.status(400).json({ error: 'Invalid image format. Use JPEG, PNG, GIF, or WebP.' });
          }

          const sizeInBytes = (req.body.customAvatar.length * 3) / 4;
          if (sizeInBytes > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image must be smaller than 2MB' });
          }

          updateData.customAvatar = req.body.customAvatar;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: updateData,
        select: profileSelect
      });

      res.json(user);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
};

module.exports = profileController;
