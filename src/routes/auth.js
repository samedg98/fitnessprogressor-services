import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

/* -------------------------------------------------- */
/* REGISTER                                            */
/* -------------------------------------------------- */

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2)",
      [email, hashedPassword]
    );

    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

/* -------------------------------------------------- */
/* LOGIN                                               */
/* -------------------------------------------------- */

router.post("/login", async (req, res) => {
  console.log("LOGIN BODY:", req.body);
  const { email, password } = req.body;

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const user = userResult.rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id },
      "supersecretkey",
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token: token
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

/* -------------------------------------------------- */
/* UPDATE PROFILE (Protected)                          */
/* -------------------------------------------------- */

router.put("/update", authenticateToken, async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const userId = req.userId; // comes from JWT middleware

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET email = $1, password_hash = $2 WHERE id = $3",
      [email, newHashedPassword, userId]
    );

    res.json({ message: "Profile updated successfully" });

  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
