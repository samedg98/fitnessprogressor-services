import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, "supersecretkey", (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }

    req.userId = user.userId;
    next();
  });
}
