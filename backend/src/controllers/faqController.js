import prisma from '../prismaClient.js';

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// GET /api/faq — public, active only, id ASC
export async function getFaq(_req, res) {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, question: true, answer: true },
    });
    return res.status(200).json({ data: faqs });
  } catch (err) {
    console.error('[getFaq] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch FAQ entries.');
  }
}

// GET /api/admin/faq — admin, all including inactive
export async function getAdminFaq(_req, res) {
  try {
    const faqs = await prisma.faq.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, question: true, answer: true, isActive: true, createdAt: true, updatedAt: true },
    });
    return res.status(200).json({ data: faqs });
  } catch (err) {
    console.error('[getAdminFaq] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch FAQ entries.');
  }
}

// POST /api/admin/faq — create
export async function createFaq(req, res) {
  const { question, answer } = req.body ?? {};

  if (!question || typeof question !== 'string' || !question.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Question is required.');
  }
  if (question.trim().length > 300) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Question must be 300 characters or fewer.');
  }
  if (!answer || typeof answer !== 'string' || !answer.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Answer is required.');
  }

  try {
    const faq = await prisma.faq.create({
      data: { question: question.trim(), answer: answer.trim() },
    });
    return res.status(201).json({ data: faq });
  } catch (err) {
    console.error('[createFaq] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create FAQ entry.');
  }
}

// PUT /api/admin/faq/:id — partial update
export async function updateFaq(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return sendError(res, 404, 'NOT_FOUND', 'FAQ entry not found.');
  }

  const { question, answer, isActive } = req.body ?? {};
  const hasAtLeastOne = question !== undefined || answer !== undefined || isActive !== undefined;
  if (!hasAtLeastOne) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'At least one field (question, answer, isActive) must be provided.');
  }

  if (question !== undefined) {
    if (typeof question !== 'string' || !question.trim()) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Question must be a non-empty string.');
    }
    if (question.trim().length > 300) {
      return sendError(res, 422, 'VALIDATION_ERROR', 'Question must be 300 characters or fewer.');
    }
  }
  if (answer !== undefined && (typeof answer !== 'string' || !answer.trim())) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Answer must be a non-empty string.');
  }

  try {
    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, 'NOT_FOUND', 'FAQ entry not found.');
    }

    const data = {};
    if (question !== undefined) data.question = question.trim();
    if (answer !== undefined) data.answer = answer.trim();
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.faq.update({ where: { id }, data });
    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error('[updateFaq] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update FAQ entry.');
  }
}

// DELETE /api/admin/faq/:id — soft-delete
export async function deleteFaq(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return sendError(res, 404, 'NOT_FOUND', 'FAQ entry not found.');
  }

  try {
    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, 'NOT_FOUND', 'FAQ entry not found.');
    }

    await prisma.faq.update({ where: { id }, data: { isActive: false } });
    return res.status(200).json({ data: { id, isActive: false } });
  } catch (err) {
    console.error('[deleteFaq] error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete FAQ entry.');
  }
}
