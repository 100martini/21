const prisma = require('../prisma');
const { notifyUser } = require('../socket');

const friendController = {
  async getFriends(req, res) {
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [
            { requesterId: req.userId },
            { addresseeId: req.userId }
          ]
        },
        include: {
          requester: {
            select: { id: true, intraId: true, login: true, displayName: true, avatar: true, customAvatar: true, nickname: true, campus: true, level: true, grade: true }
          },
          addressee: {
            select: { id: true, intraId: true, login: true, displayName: true, avatar: true, customAvatar: true, nickname: true, campus: true, level: true, grade: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      const friends = friendships.map(f => {
        const friend = f.requesterId === req.userId ? f.addressee : f.requester;
        return {
          friendshipId: f.id,
          ...friend,
          effectiveAvatar: friend.customAvatar || friend.avatar
        };
      });

      res.json(friends);
    } catch (error) {
      console.error('Error fetching friends:', error);
      res.status(500).json({ error: 'Failed to fetch friends' });
    }
  },

  async getPendingRequests(req, res) {
    try {
      const incoming = await prisma.friendship.findMany({
        where: { addresseeId: req.userId, status: 'pending' },
        include: {
          requester: {
            select: { id: true, intraId: true, login: true, displayName: true, avatar: true, customAvatar: true, nickname: true, campus: true, level: true, grade: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const outgoing = await prisma.friendship.findMany({
        where: { requesterId: req.userId, status: 'pending' },
        include: {
          addressee: {
            select: { id: true, intraId: true, login: true, displayName: true, avatar: true, customAvatar: true, nickname: true, campus: true, level: true, grade: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        incoming: incoming.map(f => ({
          friendshipId: f.id,
          ...f.requester,
          effectiveAvatar: f.requester.customAvatar || f.requester.avatar
        })),
        outgoing: outgoing.map(f => ({
          friendshipId: f.id,
          ...f.addressee,
          effectiveAvatar: f.addressee.customAvatar || f.addressee.avatar
        }))
      });
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
  },

  async sendRequest(req, res) {
    try {
      const { userId: targetId } = req.body;
      if (!targetId) return res.status(400).json({ error: 'Target user ID required' });

      const targetUserId = parseInt(targetId);
      if (targetUserId === req.userId) return res.status(400).json({ error: "You can't add yourself" });

      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: req.userId, addresseeId: targetUserId },
            { requesterId: targetUserId, addresseeId: req.userId }
          ]
        }
      });

      if (existing) {
        if (existing.status === 'accepted') return res.status(400).json({ error: 'Already friends' });
        if (existing.status === 'pending') {
          if (existing.requesterId === targetUserId) {
            const updated = await prisma.friendship.update({
              where: { id: existing.id },
              data: { status: 'accepted' }
            });
            notifyUser(targetUserId, 'friend:accepted', { friendshipId: existing.id, userId: req.userId });
            notifyUser(req.userId, 'friend:accepted', { friendshipId: existing.id, userId: targetUserId });
            return res.json({ ...updated, autoAccepted: true, message: 'Friend request accepted!' });
          }
          return res.status(400).json({ error: 'Request already sent' });
        }
      }

      const requester = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, login: true, displayName: true, avatar: true, customAvatar: true, nickname: true }
      });

      const friendship = await prisma.friendship.create({
        data: { requesterId: req.userId, addresseeId: targetUserId, status: 'pending' }
      });

      notifyUser(targetUserId, 'friend:request', {
        friendshipId: friendship.id,
        from: requester
      });

      res.json(friendship);
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  },

  async respondToRequest(req, res) {
    try {
      const { friendshipId } = req.params;
      const { accept } = req.body;

      const friendship = await prisma.friendship.findUnique({ where: { id: parseInt(friendshipId) } });
      if (!friendship) return res.status(404).json({ error: 'Request not found' });
      if (friendship.addresseeId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
      if (friendship.status !== 'pending') return res.status(400).json({ error: 'No longer pending' });

      if (accept) {
        const updated = await prisma.friendship.update({
          where: { id: parseInt(friendshipId) },
          data: { status: 'accepted' }
        });
        notifyUser(friendship.requesterId, 'friend:accepted', { friendshipId: parseInt(friendshipId), userId: req.userId });
        notifyUser(req.userId, 'friend:accepted', { friendshipId: parseInt(friendshipId), userId: friendship.requesterId });
        res.json({ ...updated, message: 'Friend request accepted' });
      } else {
        await prisma.friendship.delete({ where: { id: parseInt(friendshipId) } });
        notifyUser(friendship.requesterId, 'friend:declined', { friendshipId: parseInt(friendshipId), userId: req.userId });
        res.json({ deleted: true, message: 'Friend request declined' });
      }
    } catch (error) {
      console.error('Error responding to request:', error);
      res.status(500).json({ error: 'Failed to respond' });
    }
  },

  async removeFriend(req, res) {
    try {
      const { friendshipId } = req.params;
      const friendship = await prisma.friendship.findUnique({ where: { id: parseInt(friendshipId) } });
      if (!friendship) return res.status(404).json({ error: 'Not found' });
      if (friendship.requesterId !== req.userId && friendship.addresseeId !== req.userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const otherId = friendship.requesterId === req.userId ? friendship.addresseeId : friendship.requesterId;
      await prisma.friendship.delete({ where: { id: parseInt(friendshipId) } });
      notifyUser(otherId, 'friend:removed', { friendshipId: parseInt(friendshipId), userId: req.userId });
      res.json({ deleted: true });
    } catch (error) {
      console.error('Error removing friend:', error);
      res.status(500).json({ error: 'Failed to remove friend' });
    }
  },

  async searchFriends(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.length < 1) return res.json([]);

      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ requesterId: req.userId }, { addresseeId: req.userId }]
        },
        include: {
          requester: { select: { id: true, intraId: true, login: true, displayName: true, avatar: true, customAvatar: true, nickname: true, campus: true, level: true, grade: true } },
          addressee: { select: { id: true, intraId: true, login: true, displayName: true, avatar: true, customAvatar: true, nickname: true, campus: true, level: true, grade: true } }
        }
      });

      const searchLower = q.toLowerCase();
      const results = friendships
        .map(f => {
          const friend = f.requesterId === req.userId ? f.addressee : f.requester;
          return { friendshipId: f.id, ...friend, effectiveAvatar: friend.customAvatar || friend.avatar };
        })
        .filter(f =>
          f.login?.toLowerCase().includes(searchLower) ||
          f.nickname?.toLowerCase().includes(searchLower) ||
          f.displayName?.toLowerCase().includes(searchLower)
        );

      res.json(results);
    } catch (error) {
      console.error('Error searching friends:', error);
      res.status(500).json({ error: 'Failed to search friends' });
    }
  },

  async searchUsers(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.length < 2) return res.json([]);

      const users = await prisma.user.findMany({
        where: {
          id: { not: req.userId },
          OR: [
            { login: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
            { nickname: { contains: q, mode: 'insensitive' } }
          ]
        },
        select: { id: true, intraId: true, login: true, displayName: true, avatar: true, customAvatar: true, nickname: true, campus: true, level: true, grade: true },
        take: 10
      });

      const userIds = users.map(u => u.id);
      const existingFriendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: req.userId, addresseeId: { in: userIds } },
            { addresseeId: req.userId, requesterId: { in: userIds } }
          ]
        }
      });

      const usersWithStatus = users.map(user => {
        const friendship = existingFriendships.find(f => f.requesterId === user.id || f.addresseeId === user.id);
        let friendStatus = 'none';
        if (friendship) {
          if (friendship.status === 'accepted') friendStatus = 'friends';
          else if (friendship.requesterId === req.userId) friendStatus = 'sent';
          else friendStatus = 'received';
        }
        return { ...user, effectiveAvatar: user.customAvatar || user.avatar, friendStatus, friendshipId: friendship?.id || null };
      });

      res.json(usersWithStatus);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  }
};

module.exports = friendController;
