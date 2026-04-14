const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/projects/:projectId/board', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    let board = await prisma.board.findFirst({
      where: { projectId },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
              include: {
                creator: { select: { id: true, displayName: true, login: true, avatar: true } },
                assignee: { select: { id: true, email: true } },
                labels: true
              }
            }
          }
        }
      }
    });

    if (!board) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      board = await prisma.board.create({
        data: {
          name: project.name + ' Board',
          description: 'Project kanban board',
          projectId,
          columns: {
            create: [
              { name: 'To Do', position: 0 },
              { name: 'In Progress', position: 1 },
              { name: 'Review', position: 2 },
              { name: 'Done', position: 3 }
            ]
          }
        },
        include: {
          columns: {
            orderBy: { position: 'asc' },
            include: {
              cards: {
                orderBy: { position: 'asc' },
                include: {
                  creator: { select: { id: true, displayName: true, login: true, avatar: true } },
                  assignee: { select: { id: true, email: true } },
                  labels: true
                }
              }
            }
          }
        }
      });
    }

    res.json(board);
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

router.post('/columns/:columnId/cards', authMiddleware, async (req, res) => {
  try {
    const columnId = parseInt(req.params.columnId);
    const { title, description, priority } = req.body;

    const maxPosition = await prisma.card.aggregate({
      where: { columnId },
      _max: { position: true }
    });

    const card = await prisma.card.create({
      data: {
        title,
        description,
        priority: priority || 'medium',
        position: (maxPosition._max.position ?? -1) + 1,
        columnId,
        creatorId: req.userId
      },
      include: {
        creator: { select: { id: true, displayName: true, login: true, avatar: true } }
      }
    });

    res.json(card);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

router.patch('/cards/:id/move', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id);
    const { newColumnId, newPosition } = req.body;

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const oldColumnId = card.columnId;
    const updatedCard = await prisma.$transaction(async (tx) => {
      if (oldColumnId !== newColumnId) {
        await tx.card.updateMany({
          where: { columnId: newColumnId, position: { gte: newPosition } },
          data: { position: { increment: 1 } }
        });
      } else {
        if (newPosition > card.position) {
          await tx.card.updateMany({
            where: { columnId: oldColumnId, position: { gt: card.position, lte: newPosition } },
            data: { position: { decrement: 1 } }
          });
        } else if (newPosition < card.position) {
          await tx.card.updateMany({
            where: { columnId: oldColumnId, position: { gte: newPosition, lt: card.position } },
            data: { position: { increment: 1 } }
          });
        }
      }

      return tx.card.update({
        where: { id: cardId },
        data: { columnId: newColumnId, position: newPosition }
      });
    });

    res.json(updatedCard);
  } catch (error) {
    console.error('Error moving card:', error);
    res.status(500).json({ error: 'Failed to move card' });
  }
});

router.patch('/cards/:id', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id);
    const { title, description, priority, dueDate } = req.body;

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const updatedCard = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate })
      },
      include: {
        creator: { select: { id: true, displayName: true, login: true, avatar: true } }
      }
    });

    res.json(updatedCard);
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

router.delete('/cards/:id', async (req, res) => {
  try {
    await prisma.card.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

module.exports = router;
