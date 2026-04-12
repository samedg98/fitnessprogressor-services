import express from "express";
import pool from "../db.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();


const {
  DeleteWorkout
} = require("../controller/workoutapi.js")


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


router.delete("/workout-delete/:id" , authenticateToken, DeleteWorkout)




export default router;
