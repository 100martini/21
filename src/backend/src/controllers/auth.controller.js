const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const bcrypt = require('bcrypt');

function normalizeSlug(slug) {
  return slug.replace(/^42cursus-/, '');
}

async function syncUserFrom42(userData, userId) {
  const projectSlugs = (userData.projects_users || []).map(p => p.project?.slug).filter(Boolean);
  const hasPythonProjects = projectSlugs.some(slug => normalizeSlug(slug).includes('python-module'));
  const curriculum = hasPythonProjects ? 'new' : 'old';

  const cursus42 = userData.cursus_users?.find(c => c.cursus?.slug === '42cursus' || c.cursus_id === 21);
  const grade = cursus42?.grade || 'Cadet';

  const curriculumRecord = await prisma.curriculum.findUnique({ where: { name: curriculum } });

  const allSlugs = (userData.projects_users || [])
    .map(p => p.project?.slug)
    .filter(Boolean);

  const normalizedSlugs = allSlugs.map(normalizeSlug);

  const pcEntries = curriculumRecord
    ? await prisma.projectCurriculum.findMany({
        where: {
          curriculumId: curriculumRecord.id,
          project: { slug: { in: normalizedSlugs } }
        },
        include: { project: true }
      })
    : [];

  const slugToCircle = {};
  for (const pc of pcEntries) {
    slugToCircle[pc.project.slug] = pc.circle ?? pc.project.circle;
  }

  const fallbackProjects = await prisma.project.findMany({
    where: { slug: { in: normalizedSlugs } }
  });
  for (const p of fallbackProjects) {
    if (!(p.slug in slugToCircle)) {
      slugToCircle[p.slug] = p.circle;
    }
  }

  let highestCircle = 0;
  for (const slug of normalizedSlugs) {
    const circle = slugToCircle[slug];
    if (circle !== undefined && circle > highestCircle) {
      highestCircle = circle;
    }
  }

  const currentCircle = Math.min(highestCircle, 6);

  const intra42Slugs = new Set();
  const userProjects = userData.projects_users || [];

  for (const projectUser of userProjects) {
    if (!projectUser.project?.slug) continue;
    const is42Cursus = projectUser.cursus_ids?.includes(21);
    if (!is42Cursus) continue;

    const rawSlug = projectUser.project.slug;
    const normalized = normalizeSlug(rawSlug);
    intra42Slugs.add(normalized);

    let project = await prisma.project.findUnique({
      where: { slug: normalized }
    });

    if (!project) {
      project = await prisma.project.findUnique({
        where: { slug: rawSlug }
      });
    }

    if (!project) {
      try {
        project = await prisma.project.create({
          data: {
            slug: normalized,
            name: projectUser.project.name || normalized,
            circle: 0,
            minTeam: 1,
            maxTeam: 1,
            isOuterCore: true
          }
        });
        console.log(`Created outer core project: ${project.slug}`);
      } catch (err) {
        project = await prisma.project.findUnique({
          where: { slug: normalized }
        });
      }
    }

    if (project) {
      await prisma.userProject.upsert({
        where: { userId_projectId: { userId, projectId: project.id } },
        update: {
          status: projectUser.status,
          validated: projectUser['validated?'] || false,
          finalMark: projectUser.final_mark
        },
        create: {
          userId,
          projectId: project.id,
          status: projectUser.status,
          validated: projectUser['validated?'] || false,
          finalMark: projectUser.final_mark
        }
      });
    }
  }

  const existingUserProjects = await prisma.userProject.findMany({
    where: { userId },
    include: { project: true }
  });

  for (const up of existingUserProjects) {
    if (!intra42Slugs.has(up.project.slug) && !intra42Slugs.has(normalizeSlug(up.project.slug))) {
      if (up.project.isOuterCore) {
        await prisma.userProject.delete({ where: { id: up.id } });
        console.log(`Removed unsubscribed project: ${up.project.slug}`);
      }
    }
  }

  return { currentCircle, curriculum, grade, cursus42 };
}

const authController = {
  async redirect42(req, res) {
    const authUrl = `https://api.intra.42.fr/oauth/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code`;
    console.log('Redirecting to 42 OAuth...');
    res.redirect(authUrl);
  },

  async callback(req, res) {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
    }

    try {
      const tokenResponse = await axios.post('https://api.intra.42.fr/oauth/token', {
        grant_type: 'authorization_code',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        redirect_uri: process.env.REDIRECT_URI
      });

      const accessToken = tokenResponse.data.access_token;
      const userResponse = await axios.get('https://api.intra.42.fr/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const userData = userResponse.data;
      const cursus42 = userData.cursus_users?.find(c => c.cursus?.slug === '42cursus' || c.cursus_id === 21);

      const user = await prisma.user.upsert({
        where: { intraId: userData.id },
        update: {
          login: userData.login,
          displayName: userData.displayname || userData.usual_full_name,
          email: userData.email,
          avatar: userData.image?.link || userData.image?.versions?.medium,
          campus: userData.campus?.[0]?.name || 'Unknown',
          level: cursus42?.level || 0,
          wallet: userData.wallet || 0,
          correctionPoints: userData.correction_point || 0,
          accessToken
        },
        create: {
          intraId: userData.id,
          login: userData.login,
          displayName: userData.displayname || userData.usual_full_name,
          email: userData.email,
          avatar: userData.image?.link || userData.image?.versions?.medium,
          campus: userData.campus?.[0]?.name || 'Unknown',
          level: cursus42?.level || 0,
          wallet: userData.wallet || 0,
          correctionPoints: userData.correction_point || 0,
          accessToken
        }
      });

      const { currentCircle, curriculum, grade } = await syncUserFrom42(userData, user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { currentCircle, curriculum, grade }
      });

      const token = jwt.sign(
        { userId: user.id, intraId: user.intraId, login: user.login },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);
    } catch (error) {
      console.error('OAuth error:', error.response?.data || error.message);
      res.redirect(`${process.env.FRONTEND_URL}?error=oauth_failed`);
    }
  },

  async sync(req, res) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user || !user.accessToken) {
        return res.status(400).json({ error: 'No stored access token. Please log in again.' });
      }

      let userData;
      try {
        const userResponse = await axios.get('https://api.intra.42.fr/v2/me', {
          headers: { Authorization: `Bearer ${user.accessToken}` }
        });
        userData = userResponse.data;
      } catch (err) {
        if (err.response?.status === 401) {
          return res.status(401).json({ error: 'Access token expired. Please log in again.' });
        }
        throw err;
      }

      const cursus42 = userData.cursus_users?.find(c => c.cursus?.slug === '42cursus' || c.cursus_id === 21);

      const { currentCircle, curriculum, grade } = await syncUserFrom42(userData, user.id);

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          level: cursus42?.level || user.level,
          wallet: userData.wallet ?? user.wallet,
          correctionPoints: userData.correction_point ?? user.correctionPoints,
          currentCircle,
          curriculum,
          grade
        },
        include: { userProjects: { include: { project: true } } }
      });

      res.json({
        success: true,
        user: {
          id: updated.id,
          currentCircle: updated.currentCircle,
          curriculum: updated.curriculum,
          grade: updated.grade,
          level: updated.level,
          wallet: updated.wallet,
          correctionPoints: updated.correctionPoints,
          projectsUsers: updated.userProjects.map(up => ({
            project: {
              slug: up.project.slug,
              name: up.project.name,
              isOuterCore: up.project.isOuterCore
            },
            status: up.status,
            'validated?': up.validated,
            final_mark: up.finalMark
          }))
        }
      });
    } catch (error) {
      console.error('Sync error:', error.message);
      res.status(500).json({ error: 'Failed to sync with 42 API' });
    }
  },

  async me(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        include: {
          userProjects: {
            include: { project: true }
          }
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        intraId: user.intraId,
        login: user.login,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        nickname: user.nickname,
        customAvatar: user.customAvatar,
        campus: user.campus,
        level: user.level,
        wallet: user.wallet,
        correctionPoints: user.correctionPoints,
        curriculum: user.curriculum,
        grade: user.grade,
        currentCircle: user.currentCircle,
        bio: user.bio,
        createdAt: user.createdAt,
        projectsUsers: user.userProjects.map(up => ({
          project: {
            slug: up.project.slug,
            name: up.project.name,
            isOuterCore: up.project.isOuterCore
          },
          status: up.status,
          'validated?': up.validated,
          final_mark: up.finalMark
        }))
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  },

  async searchUsers(req, res) {
    try {
      const { q, projectSlug, curriculum, grade } = req.query;

      if (!q || q.length < 2) {
        return res.json([]);
      }

      const where = {
        OR: [
          { login: { contains: q, mode: 'insensitive' } },
          { nickname: { contains: q, mode: 'insensitive' } }
        ],
        id: { not: req.userId },
        intraId: { not: null }
      };

      if (projectSlug === 'ft_transcendence' || projectSlug === '42_collaborative_resume') {
        if (grade) {
          if (grade === 'Cadet') where.grade = 'Cadet';
          else where.grade = { not: 'Cadet' };
        }
      } else {
        if (curriculum) where.curriculum = curriculum;
        if (grade) {
          if (grade === 'Cadet') where.grade = 'Cadet';
          else where.grade = { not: 'Cadet' };
        }
      }

      let users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          intraId: true,
          login: true,
          displayName: true,
          avatar: true,
          customAvatar: true,
          nickname: true,
          campus: true,
          level: true,
          grade: true,
          userProjects: { include: { project: true } }
        },
        take: 50
      });

      if (projectSlug && projectSlug !== 'ft_transcendence') {
        const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
        if (project && project.isOuterCore) {
          users = users.filter(user =>
            user.userProjects.some(up => up.project.slug === projectSlug)
          );
        }
      }

      res.json(users.slice(0, 10).map(u => ({
        id: u.id,
        intraId: u.intraId,
        login: u.login,
        displayName: u.displayName,
        avatar: u.customAvatar || u.avatar,
        nickname: u.nickname,
        campus: u.campus,
        level: u.level,
        grade: u.grade
      })));
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  },

  async register(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    try {
      const existing = await prisma.user.findFirst({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          login: email.split('@')[0],
          displayName: email.split('@')[0],
          campus: 'Unknown',
          curriculum: 'old',
          grade: 'Cadet',
          level: 0,
          wallet: 0,
          correctionPoints: 0,
          currentCircle: 0
        }
      });

      const token = jwt.sign(
        { userId: user.id, login: user.login },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({ token });
    } catch (error) {
      console.error('Register error:', error.message);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  },

  async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const user = await prisma.user.findFirst({ where: { email } });

      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { userId: user.id, login: user.login },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ token });
    } catch (error) {
      console.error('Login error:', error.message);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  },

  async searchAllUsers(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.json([]);
      }

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { login: { contains: q, mode: 'insensitive' } },
            { nickname: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } }
          ],
          id: { not: req.userId }
        },
        select: {
          id: true,
          intraId: true,
          login: true,
          displayName: true,
          avatar: true,
          customAvatar: true,
          nickname: true,
          campus: true,
          level: true,
          grade: true
        },
        take: 10
      });

      res.json(users.map(u => ({
        id: u.id,
        intraId: u.intraId,
        login: u.login,
        displayName: u.displayName,
        avatar: u.customAvatar || u.avatar,
        nickname: u.nickname,
        campus: u.campus,
        level: u.level,
        grade: u.grade
      })));
    } catch (error) {
      console.error('Error searching all users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  }
};

module.exports = authController;
