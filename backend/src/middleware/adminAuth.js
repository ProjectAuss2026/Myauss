const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
    // Checks if there's an authHeader and if it starts with 'Bearer'
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];
  const adminSecret = process.env.ADMIN_SECRET;
  // Checks if the ADMIN_SECRET is set in the environment
  if (!adminSecret) {
    console.error('[adminAuth] ADMIN_SECRET is not set in environment variables.');
    return res.status(500).json({
      error: 'Server misconfiguration',
      message: 'Admin secret is not configured.',
    });
  }
  // Checks if the token matches the ADMIN_SECRET
  if (token !== adminSecret) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid admin token.',
    });
  }
  // If all checks pass, proceed to the controller
  next();
};

export default adminAuth;
