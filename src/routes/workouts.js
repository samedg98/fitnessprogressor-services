import express from "express";
import pool from "../db.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// BASIC TEST ROUTE
router.get("/", (req, res) => {
  res.json({ message: "Workouts route working" });
});

// DATABASE TEST ROUTE
router.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ db_time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// LOG WORKOUT (Protected)
router.post("/log", authenticateToken, async (req, res) => {
  const { exercise, sets, reps, weight, date } = req.body;

  try {
    await pool.query(
      `INSERT INTO workouts (user_id, exercise, sets, reps, weight, date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.userId, exercise, sets, reps, weight, date]
    );

    res.json({ message: "Workout logged successfully" });
  } catch (err) {
    console.error("Workout insert error:", err);
    res.status(500).json({ error: "Failed to log workout" });
  }
});

// GET WORKOUT HISTORY (Protected)
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM workouts WHERE user_id = $1 ORDER BY date DESC",
      [req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to fetch workout history" });
  }
});

// GET WORKOUT STATS (Protected)
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // WEEKLY TOTALS (last 7 days)
    const weeklyResult = await pool.query(
      `SELECT COUNT(*) 
       FROM workouts 
       WHERE user_id = $1 
       AND date >= NOW() - INTERVAL '7 days'`,
      [userId]
    );
    const weeklyTotals = parseInt(weeklyResult.rows[0].count);

    // MONTHLY TOTALS (last 30 days)
    const monthlyResult = await pool.query(
      `SELECT COUNT(*) 
       FROM workouts 
       WHERE user_id = $1 
       AND date >= NOW() - INTERVAL '30 days'`,
      [userId]
    );
    const monthlyTotals = parseInt(monthlyResult.rows[0].count);

    // TOTAL WEIGHT LIFTED THIS WEEK
    const weightResult = await pool.query(
      `SELECT COALESCE(SUM(sets * reps * weight), 0) AS total
       FROM workouts
       WHERE user_id = $1
       AND date >= NOW() - INTERVAL '7 days'`,
      [userId]
    );
    const totalWeightThisWeek = parseInt(weightResult.rows[0].total);

    return res.json({
      weeklyTotals,
      monthlyTotals,
      totalWeightThisWeek,
      averageRepsThisWeek: null,
      lastFiveWorkouts: []
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch workout stats" });
  }
});

export default router;
