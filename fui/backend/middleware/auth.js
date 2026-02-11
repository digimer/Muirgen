import jwt from 'jsonwebtoken';
  
  // Middleware to protect routes and extract user data.
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // No token found.
  if (!token) {
    return res.status(401).json({ error: "Security: Authentication required!" });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'this_is_bad_fallback_key', (err, user) => {
    if (err) {
      // Token is invalid
      return res.status(403).json({ error: "Security: Session expired or invalid!" });
    }
    // Token is valid, 
    req.user = user;
    next();
  }) 
};

// Catch 403 errors caused by things like forgetting to import a function to prevent hard crashes.
export const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: "Security: System operator access required" });
  }
  next();
};
