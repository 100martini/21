const prisma = require('../prisma');
const { notifyUser, notifyUsers } = require('../socket');

const teamController = {
  async createTeam(req, res) {
    try {
      const { name, projectSlug, memberIds } = req.body;

      if (!name || !projectSlug || !memberIds || memberIds.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      if (!project.isUserCreated && memberIds.length > 0) {
        const creator = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!creator?.intraId) {
          return res.status(403).json({ error: 'Only 42 intra users can form teams on 42 projects.' });
        }
        const invitees = await prisma.user.findMany({
          where: { id: { in: memberIds.map(id => parseInt(id)) } },
          select: { id: true, login: true, intraId: true }
        });
        const nonIntra = invitees.filter(u => !u.intraId);
        if (nonIntra.length > 0) {
          return res.status(400).json({
            error: `Cannot invite non-42 users to a 42 project: ${nonIntra.map(u => u.login).join(', ')}`
          });
        }
      }

      const creatorTeam = await prisma.team.findFirst({
        where: { projectId: project.id, members: { some: { userId: req.userId } } }
      });
      if (creatorTeam) {
        return res.status(400).json({ error: 'You already have a team for this project' });
      }

      const creatorPendingInvite = await prisma.teamMember.findFirst({
        where: {
          userId: req.userId,
          status: 'pending',
          team: { projectId: project.id, status: 'pending' }
        }
      });
      if (creatorPendingInvite) {
        return res.status(400).json({ error: 'You have a pending team invite for this project. Accept or decline it first.' });
      }

      for (const memberId of memberIds) {
        const memberTeam = await prisma.team.findFirst({
          where: { projectId: project.id, members: { some: { userId: parseInt(memberId) } } }
        });
        if (memberTeam) {
          const memberUser = await prisma.user.findUnique({ where: { id: parseInt(memberId) } });
          return res.status(400).json({ error: `${memberUser?.login || 'A member'} already has a team for this project` });
        }
      }

      const team = await prisma.team.create({
        data: {
          name,
          projectId: project.id,
          creatorId: req.userId,
          status: 'pending',
          members: {
            create: [
              { userId: req.userId, status: 'approved' },
              ...memberIds.map(userId => ({ userId: parseInt(userId), status: 'pending' }))
            ]
          }
        },
        include: { members: { include: { user: true } }, project: true, creator: true }
      });

      const creatorUser = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { login: true }
      });

      memberIds.forEach(memberId => {
        notifyUser(parseInt(memberId), 'team:invite', {
          teamId: team.id,
          teamName: name,
          projectName: project.name,
          projectSlug: project.slug,
          creatorLogin: creatorUser?.login
        });
      });

      res.json(team);
    } catch (error) {
      console.error('Create team error:', error);
      res.status(500).json({ error: 'Failed to create team' });
    }
  },

  async getPendingInvites(req, res) {
    try {
      const teams = await prisma.team.findMany({
        where: {
          members: { some: { userId: req.userId, status: 'pending' } }
        },
        include: { members: { include: { user: true } }, project: true, creator: true },
        orderBy: { createdAt: 'desc' }
      });

      const formattedTeams = teams.map(team => {
        const myMember = team.members.find(m => m.userId === req.userId);
        return {
          ...team,
          acceptanceCount: team.members.filter(m => m.status === 'approved').length,
          totalMembers: team.members.length,
          myStatus: myMember?.status || 'pending'
        };
      });

      res.json(formattedTeams);
    } catch (error) {
      console.error('Get pending invites error:', error);
      res.status(500).json({ error: 'Failed to fetch pending invites' });
    }
  },

  async respondToInvite(req, res) {
    try {
      const { teamId } = req.params;
      const { accept } = req.body;

      const team = await prisma.team.findUnique({
        where: { id: parseInt(teamId) },
        include: { members: true, project: true }
      });

      if (!team) return res.status(404).json({ error: 'Team not found' });

      const member = team.members.find(m => m.userId === req.userId);
      if (!member) return res.status(403).json({ error: 'Not a team member' });

      const responder = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { login: true }
      });

      const otherMemberIds = team.members
        .filter(m => m.userId !== req.userId)
        .map(m => m.userId);

      if (accept) {
        await prisma.teamMember.update({
          where: { id: member.id },
          data: { status: 'approved' }
        });

        const updatedTeam = await prisma.team.findUnique({
          where: { id: parseInt(teamId) },
          include: { members: true }
        });

        const approvedCount = updatedTeam.members.filter(m => m.status === 'approved').length;
        const totalMembers = updatedTeam.members.length;
        const allApproved = approvedCount === totalMembers;

        if (allApproved) {
          await prisma.team.update({
            where: { id: parseInt(teamId) },
            data: { status: 'approved' }
          });
        }

        notifyUsers(otherMemberIds, 'team:response', {
          teamId: parseInt(teamId),
          teamName: team.name,
          projectSlug: team.project.slug,
          responderLogin: responder?.login,
          accepted: true,
          isActive: allApproved,
          acceptanceCount: approvedCount,
          totalMembers
        });

        res.json({
          success: true,
          acceptanceCount: approvedCount,
          totalMembers,
          isActive: allApproved
        });

      } else {
        // Remove only this member — don't nuke the whole team
        await prisma.teamMember.delete({ where: { id: member.id } });

        const updatedTeam = await prisma.team.findUnique({
          where: { id: parseInt(teamId) },
          include: { members: true }
        });

        // No members left at all — delete the team
        if (!updatedTeam || updatedTeam.members.length === 0) {
          await prisma.team.delete({ where: { id: parseInt(teamId) } });
          notifyUsers(otherMemberIds, 'team:deleted', {
            teamId: parseInt(teamId),
            teamName: team.name
          });
          return res.json({ declined: true, deleted: true });
        }

        const approvedCount = updatedTeam.members.filter(m => m.status === 'approved').length;
        const totalRemaining = updatedTeam.members.length;
        const allApproved = approvedCount === totalRemaining;
        const minTeam = team.project?.minTeam ?? 1;
        const meetsMinTeam = totalRemaining >= minTeam;

        // Can never reach minTeam anymore — delete the team
        if (!meetsMinTeam) {
          await prisma.team.delete({ where: { id: parseInt(teamId) } });
          notifyUsers(otherMemberIds, 'team:deleted', {
            teamId: parseInt(teamId),
            teamName: team.name
          });
          return res.json({ declined: true, deleted: true });
        }

        if (allApproved) {
          // Remaining members all accepted and team is still valid — go active
          await prisma.team.update({
            where: { id: parseInt(teamId) },
            data: { status: 'approved' }
          });

          notifyUsers(otherMemberIds, 'team:response', {
            teamId: parseInt(teamId),
            teamName: team.name,
            projectSlug: team.project.slug,
            responderLogin: responder?.login,
            accepted: false,
            isActive: true,
            acceptanceCount: approvedCount,
            totalMembers: totalRemaining
          });
        } else {
          // Team stays pending — notify with updated counts
          notifyUsers(otherMemberIds, 'team:declined', {
            teamId: parseInt(teamId),
            teamName: team.name,
            projectSlug: team.project.slug,
            responderLogin: responder?.login,
            acceptanceCount: approvedCount,
            totalMembers: totalRemaining
          });
        }

        res.json({ declined: true });
      }
    } catch (error) {
      console.error('Respond to invite error:', error);
      res.status(500).json({ error: 'Failed to respond to invite' });
    }
  },

  async inviteToTeam(req, res) {
    try {
      const { memberIds, projectSlug } = req.body;

      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: 'memberIds is required.' });
      }
      if (!projectSlug) {
        return res.status(400).json({ error: 'projectSlug is required.' });
      }

      let team = await prisma.team.findFirst({
        where: {
          creatorId: req.userId,
          project: { slug: projectSlug, isUserCreated: true }
        },
        include: { project: true, members: true }
      });

      if (!team) {
        const project = await prisma.project.findFirst({
          where: { slug: projectSlug, isUserCreated: true, createdById: req.userId }
        });
        if (!project) return res.status(404).json({ error: 'Project not found.' });

        team = await prisma.team.create({
          data: {
            name: `${project.name} Team`,
            projectId: project.id,
            creatorId: req.userId,
            status: 'pending',
            members: {
              create: [{ userId: req.userId, status: 'approved' }]
            }
          },
          include: { project: true, members: true }
        });
      }

      if (team.creatorId !== req.userId) return res.status(403).json({ error: 'Only the team creator can invite members.' });

      const newIds = memberIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      const existingIds = new Set(team.members.map(m => m.userId));
      const toAdd = newIds.filter(id => !existingIds.has(id));

      if (toAdd.length === 0) {
        return res.status(400).json({ error: 'All specified users are already in the team.' });
      }

      await prisma.$transaction([
        ...toAdd.map(userId =>
          prisma.teamMember.create({ data: { teamId: team.id, userId, status: 'pending' } })
        ),
        prisma.team.update({ where: { id: team.id }, data: { status: 'pending' } })
      ]);

      const creator = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { login: true }
      });

      toAdd.forEach(memberId => {
        notifyUser(memberId, 'team:invite', {
          teamId: team.id,
          teamName: team.name,
          projectName: team.project.name,
          projectSlug: team.project.slug,
          creatorLogin: creator?.login
        });
      });

      const updated = await prisma.team.findUnique({
        where: { id: team.id },
        include: { members: { include: { user: true } }, project: true, creator: true }
      });

      res.json(updated);
    } catch (error) {
      console.error('Invite to team error:', error);
      res.status(500).json({ error: 'Failed to invite members.' });
    }
  },

  async getMyTeams(req, res) {
    try {
      const teams = await prisma.team.findMany({
        where: {
          members: { some: { userId: req.userId, status: 'approved' } }
        },
        include: {
          members: { include: { user: true } },
          project: true,
          creator: true,
          deleteRequest: {
            include: {
              requester: { select: { id: true, login: true } },
              approvals: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedTeams = teams.map(team => {
        const formatted = { ...team, deleteRequest: null, isPending: false };

        if (team.status === 'pending') {
          formatted.acceptanceCount = team.members.filter(m => m.status === 'approved').length;
          formatted.totalMembers = team.members.length;
          formatted.isPending = true;
        }

        if (team.deleteRequest && team.deleteRequest.status === 'pending') {
          formatted.deleteRequest = {
            id: team.deleteRequest.id,
            requestedBy: team.deleteRequest.requester,
            requestedByLogin: team.deleteRequest.requester.login,
            approvalCount: team.deleteRequest.approvals.filter(a => a.approved).length,
            totalMembers: team.members.length,
            teamName: team.name
          };
        }

        return formatted;
      });

      res.json(formattedTeams);
    } catch (error) {
      console.error('Get my teams error:', error);
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  },

  async removeTeamMember(req, res) {
    try {
      const teamId = parseInt(req.params.teamId);
      const memberId = parseInt(req.params.memberId);

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true, project: true }
      });

      if (!team) return res.status(404).json({ error: 'Team not found' });

      if (team.creatorId !== req.userId) {
        return res.status(403).json({ error: 'Only the team creator can remove members' });
      }

      if (memberId === req.userId) {
        return res.status(400).json({ error: 'You cannot remove yourself. Delete the team instead.' });
      }

      const member = team.members.find(m => m.userId === memberId);
      if (!member) {
        return res.status(404).json({ error: 'Member not found in this team' });
      }

      const approvedAfterRemoval = team.members.filter(m => m.status === 'approved' && m.userId !== memberId).length;
      const minTeam = team.project?.minTeam || 1;

      if (approvedAfterRemoval < minTeam) {
        // Team would fall below minTeam — delete the whole team
        const otherIds = team.members.filter(m => m.userId !== req.userId).map(m => m.userId);
        await prisma.team.delete({ where: { id: teamId } });
        notifyUsers(otherIds, 'team:deleted', { teamId, teamName: team.name });
        return res.json({ removed: true, teamDeleted: true });
      }

      await prisma.teamMember.delete({ where: { id: member.id } });

      notifyUser(memberId, 'team:removed', { teamId, teamName: team.name });

      return res.json({ removed: true });
    } catch (error) {
      console.error('Remove team member error:', error);
      res.status(500).json({ error: 'Failed to remove team member' });
    }
  },

  async deleteTeam(req, res) {
    try {
      const { teamId } = req.params;

      const team = await prisma.team.findUnique({
        where: { id: parseInt(teamId) },
        include: { members: true }
      });

      if (!team) return res.status(404).json({ error: 'Team not found' });

      const isMember = team.members.some(m => m.userId === req.userId);
      if (!isMember) return res.status(403).json({ error: 'Not a team member' });

      const otherIds = team.members.filter(m => m.userId !== req.userId).map(m => m.userId);
      await prisma.team.delete({ where: { id: parseInt(teamId) } });
      notifyUsers(otherIds, 'team:deleted', { teamId: parseInt(teamId), teamName: team.name });
      return res.json({ deleted: true });
    } catch (error) {
      console.error('Delete team error:', error);
      res.status(500).json({ error: 'Failed to delete team' });
    }
  },

  async requestDeleteTeam(req, res) {
    try {
      const { teamId } = req.params;

      const team = await prisma.team.findUnique({
        where: { id: parseInt(teamId) },
        include: { members: true, deleteRequest: true }
      });

      if (!team) return res.status(404).json({ error: 'Team not found' });

      const isMember = team.members.some(m => m.userId === req.userId);
      if (!isMember) return res.status(403).json({ error: 'Not a team member' });

      const approvedMembers = team.members.filter(m => m.status === 'approved');
      const approvedOtherMembers = approvedMembers.filter(m => m.userId !== req.userId);

      if (approvedOtherMembers.length === 0) {
        const teamWithProject = await prisma.team.findUnique({
          where: { id: parseInt(teamId) },
          include: { project: true }
        });
        await prisma.team.delete({ where: { id: parseInt(teamId) } });
        if (teamWithProject?.project?.isUserCreated) {
          await prisma.project.delete({ where: { id: teamWithProject.project.id } });
        }
        return res.json({ deleted: true });
      }

      if (team.deleteRequest && team.deleteRequest.status === 'pending') {
        return res.status(400).json({ error: 'Delete request already pending' });
      }

      if (team.deleteRequest) {
        await prisma.deleteRequest.delete({ where: { id: team.deleteRequest.id } });
      }

      const deleteRequest = await prisma.deleteRequest.create({
        data: {
          teamId: parseInt(teamId),
          requesterId: req.userId,
          status: 'pending',
          approvals: {
            create: { userId: req.userId, approved: true }
          }
        },
        include: {
          requester: { select: { id: true, login: true } },
          approvals: true
        }
      });

      const otherMemberIds = approvedOtherMembers.map(m => m.userId);

      notifyUsers(otherMemberIds, 'team:delete-request', {
        requestId: deleteRequest.id,
        teamId: parseInt(teamId),
        teamName: team.name,
        requestedByLogin: deleteRequest.requester.login
      });

      res.json({
        id: deleteRequest.id,
        teamId: parseInt(teamId),
        requestedBy: deleteRequest.requester,
        approvalCount: 1,
        totalMembers: approvedMembers.length,
        status: 'pending'
      });
    } catch (error) {
      console.error('Request delete team error:', error);
      res.status(500).json({ error: 'Failed to request deletion' });
    }
  },

  async getDeleteRequests(req, res) {
    try {
      const deleteRequests = await prisma.deleteRequest.findMany({
        where: {
          status: 'pending',
          requesterId: { not: req.userId },
          team: { members: { some: { userId: req.userId } } }
        },
        include: {
          team: { include: { project: true, members: true } },
          requester: { select: { id: true, login: true } },
          approvals: true
        }
      });

      const formatted = deleteRequests.map(dr => {
        const myApproval = dr.approvals.find(a => a.userId === req.userId);
        return {
          id: dr.id,
          teamId: dr.teamId,
          teamName: dr.team.name,
          project: { name: dr.team.project.name, slug: dr.team.project.slug },
          requestedBy: dr.requester,
          approvalCount: dr.approvals.filter(a => a.approved).length,
          totalMembers: dr.team.members.length,
          status: dr.status,
          myStatus: myApproval ? (myApproval.approved ? 'approved' : 'rejected') : 'pending'
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error('Get delete requests error:', error);
      res.status(500).json({ error: 'Failed to fetch delete requests' });
    }
  },

  async respondToDeleteRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { accept } = req.body;

      const deleteRequest = await prisma.deleteRequest.findUnique({
        where: { id: parseInt(requestId) },
        include: {
          team: { include: { members: true } },
          approvals: true
        }
      });

      if (!deleteRequest) return res.status(404).json({ error: 'Delete request not found' });
      if (deleteRequest.status !== 'pending') return res.status(400).json({ error: 'Delete request is no longer pending' });

      const isMember = deleteRequest.team.members.some(m => m.userId === req.userId);
      if (!isMember) return res.status(403).json({ error: 'Not a team member' });

      const alreadyResponded = deleteRequest.approvals.some(a => a.userId === req.userId);
      if (alreadyResponded) return res.status(400).json({ error: 'Already responded to this request' });

      const otherMemberIds = deleteRequest.team.members
        .filter(m => m.userId !== req.userId)
        .map(m => m.userId);

      if (accept) {
        await prisma.deleteApproval.create({
          data: { deleteRequestId: parseInt(requestId), userId: req.userId, approved: true }
        });

        const updatedRequest = await prisma.deleteRequest.findUnique({
          where: { id: parseInt(requestId) },
          include: { team: { include: { members: true } }, approvals: true }
        });

        const approvedCount = updatedRequest.approvals.filter(a => a.approved).length;
        const totalMembers = updatedRequest.team.members.filter(m => m.status === 'approved').length;

        if (approvedCount >= totalMembers) {
          const teamWithProject = await prisma.team.findUnique({
            where: { id: deleteRequest.teamId },
            include: { project: true }
          });
          await prisma.team.delete({ where: { id: deleteRequest.teamId } });
          if (teamWithProject?.project?.isUserCreated) {
            await prisma.project.delete({ where: { id: teamWithProject.project.id } });
          }
          notifyUsers(otherMemberIds, 'team:deleted', {
            teamId: deleteRequest.teamId,
            teamName: deleteRequest.team.name
          });
          return res.json({ deleted: true, message: 'All members approved. Team deleted.' });
        }

        notifyUsers(otherMemberIds, 'team:delete-response', {
          requestId: parseInt(requestId),
          teamId: deleteRequest.teamId,
          approved: true,
          approvedCount,
          totalMembers
        });

        res.json({ success: true, approvedCount, totalMembers });
      } else {
        await prisma.deleteRequest.update({
          where: { id: parseInt(requestId) },
          data: { status: 'rejected' }
        });

        notifyUsers(otherMemberIds, 'team:delete-rejected', {
          requestId: parseInt(requestId),
          teamId: deleteRequest.teamId
        });

        res.json({ rejected: true, message: 'Delete request rejected' });
      }
    } catch (error) {
      console.error('Respond to delete request error:', error);
      res.status(500).json({ error: 'Failed to respond to delete request' });
    }
  }
};

module.exports = teamController;