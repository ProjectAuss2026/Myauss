import prisma from '../prismaClient.js';

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

const SIMPLE_URL_RE = /^https?:\/\/.+/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROTECTED_ROLE_IDS = [1, 2]; // President, Vice President

// ── Public endpoints ──

// GET /api/executives — active, grouped by team (teamId ASC → roleId ASC → createdAt ASC)
export async function getExecutives(_req, res) {
  try {
    const executives = await prisma.executive.findMany({
      where: { isActive: true },
      include: {
        role: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: [{ teamId: 'asc' }, { roleId: 'asc' }, { createdAt: 'asc' }],
    });

    // Group by team
    const teamMap = new Map();
    for (const exec of executives) {
      const teamKey = exec.team.id;
      if (!teamMap.has(teamKey)) {
        teamMap.set(teamKey, { team: exec.team, members: [] });
      }
      teamMap.get(teamKey).members.push({
        id: exec.id,
        name: exec.name,
        role: exec.role,
        imageUrl: exec.imageUrl,
        bio: exec.bio,
        instagramUrl: exec.instagramUrl,
        email: exec.email,
      });
    }

    return res.status(200).json({ data: Array.from(teamMap.values()) });
  } catch (err) {
    console.error('[getExecutives] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch executives.');
  }
}

// ── Admin: Exec members ──

// GET /api/admin/executives — all incl. inactive
export async function getAdminExecutives(_req, res) {
  try {
    const executives = await prisma.executive.findMany({
      include: {
        role: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: [{ teamId: 'asc' }, { roleId: 'asc' }, { createdAt: 'asc' }],
    });
    return res.status(200).json({ data: executives });
  } catch (err) {
    console.error('[getAdminExecutives] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch executives.');
  }
}

function validateExecFields(body, isCreate) {
  const { name, roleId, teamId, imageUrl, bio, instagramUrl, email } = body;

  if (isCreate || name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return 'Name is required.';
    }
    if (name.trim().length > 100) return 'Name must be 100 characters or fewer.';
  }
  if (isCreate || roleId !== undefined) {
    if (!roleId || !Number.isInteger(Number(roleId)) || Number(roleId) < 1) {
      return 'A valid roleId is required.';
    }
  }
  if (isCreate || teamId !== undefined) {
    if (!teamId || !Number.isInteger(Number(teamId)) || Number(teamId) < 1) {
      return 'A valid teamId is required.';
    }
  }
  if (bio !== undefined && bio !== null && bio.length > 300) {
    return 'Bio must be 300 characters or fewer.';
  }
  if (instagramUrl && instagramUrl.trim() && !SIMPLE_URL_RE.test(instagramUrl.trim())) {
    return 'instagramUrl must be a valid URL.';
  }
  if (imageUrl && imageUrl.trim() && !SIMPLE_URL_RE.test(imageUrl.trim())) {
    return 'imageUrl must be a valid URL.';
  }
  if (email && email.trim() && !EMAIL_RE.test(email.trim())) {
    return 'email must be a valid email address.';
  }
  return null;
}

// POST /api/admin/executives — create
export async function createExecutive(req, res) {
  const validationError = validateExecFields(req.body ?? {}, true);
  if (validationError) return sendError(res, 422, 'VALIDATION_ERROR', validationError);

  const { name, roleId, teamId, imageUrl, bio, instagramUrl, email } = req.body;

  try {
    const [roleExists, teamExists] = await Promise.all([
      prisma.execRole.findUnique({ where: { id: Number(roleId) } }),
      prisma.execTeam.findUnique({ where: { id: Number(teamId) } }),
    ]);
    if (!roleExists) return sendError(res, 422, 'VALIDATION_ERROR', 'roleId does not reference an existing role.');
    if (!teamExists) return sendError(res, 422, 'VALIDATION_ERROR', 'teamId does not reference an existing team.');

    const exec = await prisma.executive.create({
      data: {
        name: name.trim(),
        roleId: Number(roleId),
        teamId: Number(teamId),
        imageUrl: imageUrl?.trim() || null,
        bio: bio?.trim() || null,
        instagramUrl: instagramUrl?.trim() || null,
        email: email?.trim() || null,
      },
      include: {
        role: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });
    return res.status(201).json({ data: exec });
  } catch (err) {
    console.error('[createExecutive] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create executive.');
  }
}

// PUT /api/admin/executives/:id — partial update
export async function updateExecutive(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return sendError(res, 404, 'NOT_FOUND', 'Executive not found.');

  const body = req.body ?? {};
  if (Object.keys(body).length === 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'At least one field must be provided.');
  }

  const validationError = validateExecFields(body, false);
  if (validationError) return sendError(res, 422, 'VALIDATION_ERROR', validationError);

  try {
    const existing = await prisma.executive.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, 'NOT_FOUND', 'Executive not found.');

    if (body.roleId !== undefined) {
      const roleExists = await prisma.execRole.findUnique({ where: { id: Number(body.roleId) } });
      if (!roleExists) return sendError(res, 422, 'VALIDATION_ERROR', 'roleId does not reference an existing role.');
    }
    if (body.teamId !== undefined) {
      const teamExists = await prisma.execTeam.findUnique({ where: { id: Number(body.teamId) } });
      if (!teamExists) return sendError(res, 422, 'VALIDATION_ERROR', 'teamId does not reference an existing team.');
    }

    const data = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.roleId !== undefined) data.roleId = Number(body.roleId);
    if (body.teamId !== undefined) data.teamId = Number(body.teamId);
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl?.trim() || null;
    if (body.bio !== undefined) data.bio = body.bio?.trim() || null;
    if (body.instagramUrl !== undefined) data.instagramUrl = body.instagramUrl?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim() || null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const updated = await prisma.executive.update({
      where: { id },
      data,
      include: {
        role: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });
    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error('[updateExecutive] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update executive.');
  }
}

// DELETE /api/admin/executives/:id — soft-delete
export async function deleteExecutive(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return sendError(res, 404, 'NOT_FOUND', 'Executive not found.');

  try {
    const existing = await prisma.executive.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, 'NOT_FOUND', 'Executive not found.');

    await prisma.executive.delete({ where: { id } });
    return res.status(200).json({ data: { id, deleted: true } });
  } catch (err) {
    console.error('[deleteExecutive] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete executive.');
  }
}

// ── Admin: Roles ──

export async function getExecRoles(_req, res) {
  try {
    const roles = await prisma.execRole.findMany({ orderBy: { id: 'asc' } });
    return res.status(200).json({ data: roles });
  } catch (err) {
    console.error('[getExecRoles] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch roles.');
  }
}

export async function createExecRole(req, res) {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Role name is required.');
  }
  try {
    const role = await prisma.execRole.create({ data: { name: name.trim() } });
    return res.status(201).json({ data: role });
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 409, 'CONFLICT', 'A role with that name already exists.');
    console.error('[createExecRole] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create role.');
  }
}

export async function deleteExecRole(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return sendError(res, 404, 'NOT_FOUND', 'Role not found.');

  if (PROTECTED_ROLE_IDS.includes(id)) {
    return sendError(res, 403, 'FORBIDDEN', 'President and Vice President roles cannot be deleted.');
  }

  try {
    const existing = await prisma.execRole.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, 'NOT_FOUND', 'Role not found.');

    const activeExecs = await prisma.executive.count({ where: { roleId: id, isActive: true } });
    if (activeExecs > 0) {
      return sendError(res, 409, 'CONFLICT', 'Cannot delete a role with active executives assigned. Reassign or deactivate them first.');
    }

    await prisma.execRole.delete({ where: { id } });
    return res.status(200).json({ data: { id, deleted: true } });
  } catch (err) {
    console.error('[deleteExecRole] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete role.');
  }
}

// ── Admin: Teams ──

export async function getExecTeams(_req, res) {
  try {
    const teams = await prisma.execTeam.findMany({ orderBy: { id: 'asc' } });
    return res.status(200).json({ data: teams });
  } catch (err) {
    console.error('[getExecTeams] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch teams.');
  }
}

export async function createExecTeam(req, res) {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Team name is required.');
  }
  try {
    const team = await prisma.execTeam.create({ data: { name: name.trim() } });
    return res.status(201).json({ data: team });
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 409, 'CONFLICT', 'A team with that name already exists.');
    console.error('[createExecTeam] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create team.');
  }
}

export async function deleteExecTeam(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return sendError(res, 404, 'NOT_FOUND', 'Team not found.');

  try {
    const existing = await prisma.execTeam.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, 'NOT_FOUND', 'Team not found.');

    const activeExecs = await prisma.executive.count({ where: { teamId: id, isActive: true } });
    if (activeExecs > 0) {
      return sendError(res, 409, 'CONFLICT', 'Cannot delete a team with active executives assigned. Reassign or deactivate them first.');
    }

    await prisma.execTeam.delete({ where: { id } });
    return res.status(200).json({ data: { id, deleted: true } });
  } catch (err) {
    console.error('[deleteExecTeam] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete team.');
  }
}
