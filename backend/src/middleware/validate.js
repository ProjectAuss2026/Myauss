import { ZodError } from 'zod';

const REQUEST_PARTS = ['body', 'params', 'query'];

function formatPath(section, issuePath) {
  return [section, ...issuePath.map(String)].join('.');
}

function formatZodError(error, section) {
  return error.issues.map((issue) => ({
    path: formatPath(section, issue.path),
    message: issue.message,
  }));
}

export function formatValidationError(error, section = 'body') {
  if (error instanceof ZodError) {
    return formatZodError(error, section);
  }
  return [{ path: section, message: 'Invalid input' }];
}

export default function validate(schemaByPart) {
  return async (req, res, next) => {
    const details = [];

    for (const section of REQUEST_PARTS) {
      const schema = schemaByPart?.[section];
      if (!schema) continue;

      const result = await schema.safeParseAsync(req[section]);
      if (!result.success) {
        details.push(...formatZodError(result.error, section));
        continue;
      }

      req[section] = result.data;
    }

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }

    return next();
  };
}
