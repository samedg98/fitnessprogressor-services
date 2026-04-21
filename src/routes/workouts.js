import express from "express";
import pool from "../db.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

/* -------------------------------------------------- */
/* BASIC TEST ROUTES                                   */
/* -------------------------------------------------- */

router.get("/", (req, res) => {
  res.json({ message: "Workouts route working" });
});

router.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ db_time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

/* -------------------------------------------------- */
/* LOG WORKOUT (Protected)                             */
/* -------------------------------------------------- */

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

/* -------------------------------------------------- */
/* DELETE WORKOUT (Protected)                          */
/* -------------------------------------------------- */

router.delete("/:id", authenticateToken, async (req, res) => {
  const workoutId = req.params.id;

  try {
    const result = await pool.query(
      `DELETE FROM workouts 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [workoutId, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Workout not found" });
    }

    res.json({ message: "Workout deleted successfully" });
  } catch (err) {
    console.error("Workout delete error:", err);
    res.status(500).json({ error: "Failed to delete workout" });
  }
});

/* -------------------------------------------------- */
/* GET WORKOUT HISTORY (Protected)                     */
/* -------------------------------------------------- */

router.get("/history", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * 
       FROM workouts 
       WHERE user_id = $1 
       ORDER BY date DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to fetch workout history" });
  }
});

/* -------------------------------------------------- */
/* GET WORKOUT STATS (Protected)                       */
/* -------------------------------------------------- */

router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    /* WEEKLY TOTALS (last 7 days) */
    const weeklyResult = await pool.query(
      `SELECT COUNT(*) 
       FROM workouts 
       WHERE user_id = $1 
       AND date >= NOW() - INTERVAL '7 days'`,
      [userId]
    );
    const weeklyTotals = parseInt(weeklyResult.rows[0].count);

    /* MONTHLY TOTALS (last 30 days) */
    const monthlyResult = await pool.query(
      `SELECT COUNT(*) 
       FROM workouts 
       WHERE user_id = $1 
       AND date >= NOW() - INTERVAL '30 days'`,
      [userId]
    );
    const monthlyTotals = parseInt(monthlyResult.rows[0].count);

    /* TOTAL WEIGHT LIFTED THIS WEEK */
    const weightResult = await pool.query(
      `SELECT COALESCE(SUM(sets * reps * weight), 0) AS total
       FROM workouts
       WHERE user_id = $1
       AND date >= NOW() - INTERVAL '7 days'`,
      [userId]
    );
    const totalWeightThisWeek = parseInt(weightResult.rows[0].total);

    /* AVERAGE REPS THIS WEEK */
    const avgRepsResult = await pool.query(
      `SELECT COALESCE(AVG(reps), 0) AS avg_reps
       FROM workouts
       WHERE user_id = $1
       AND date >= NOW() - INTERVAL '7 days'`,
      [userId]
    );
    const averageRepsThisWeek = parseFloat(avgRepsResult.rows[0].avg_reps);

    /* LAST FIVE WORKOUTS */
    const lastFiveResult = await pool.query(
      `SELECT exercise, sets, reps, weight, date
       FROM workouts
       WHERE user_id = $1
       ORDER BY date DESC
       LIMIT 5`,
      [userId]
    );
    const lastFiveWorkouts = lastFiveResult.rows;

    /* MOST COMMON EXERCISE */
    const commonExerciseResult = await pool.query(
      `SELECT exercise, COUNT(*) AS count
       FROM workouts
       WHERE user_id = $1
       GROUP BY exercise
       ORDER BY count DESC
       LIMIT 1`,
      [userId]
    );

    const mostCommonExercise =
      commonExerciseResult.rows.length > 0
        ? commonExerciseResult.rows[0].exercise
        : null;

    /* WEEKLY BREAKDOWN (current week, Mon–Sun, America/Chicago) */
    const weeklyBreakdownResult = await pool.query(
      `SELECT 
          TO_CHAR(date AT TIME ZONE 'America/Chicago', 'Dy') AS day,
          EXTRACT(DOW FROM date AT TIME ZONE 'America/Chicago') AS dow,
          COUNT(*) AS total
       FROM workouts
       WHERE user_id = $1
         AND date >= DATE_TRUNC('week', (NOW() AT TIME ZONE 'America/Chicago'))
       GROUP BY day, dow
       ORDER BY dow ASC`,
      [userId]
    );

    const rawWeekly = weeklyBreakdownResult.rows;

    const orderedDays = [
      { label: "Mon", dow: 1 },
      { label: "Tue", dow: 2 },
      { label: "Wed", dow: 3 },
      { label: "Thu", dow: 4 },
      { label: "Fri", dow: 5 },
      { label: "Sat", dow: 6 },
      { label: "Sun", dow: 0 },
    ];

    const weeklyBreakdown = orderedDays.map((d) => {
      const match = rawWeekly.find(
        (row) => parseInt(row.dow) === d.dow
      );
      return {
        day: d.label,
        total: match ? parseInt(match.total) : 0,
      };
    });

    /* MONTHLY HISTORY (last 6 months) */
    const monthlyHistoryResult = await pool.query(
      `SELECT 
          TO_CHAR(date, 'Mon') AS month,
          DATE_TRUNC('month', date) AS month_start,
          COUNT(*) AS total
       FROM workouts
       WHERE user_id = $1
       AND date >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
       GROUP BY month, month_start
       ORDER BY month_start ASC`,
      [userId]
    );

    const monthlyHistory = monthlyHistoryResult.rows.map((row) => ({
      month: row.month,
      total: parseInt(row.total),
    }));

    /* -------------------------------------------------- */
    /* STRENGTH PROGRESSION (Top 3 exercises)             */
    /* -------------------------------------------------- */

    const recentMaxResult = await pool.query(
      `SELECT exercise, MAX(weight) AS max_weight
       FROM workouts
       WHERE user_id = $1
         AND weight IS NOT NULL
         AND date >= NOW() - INTERVAL '30 days'
       GROUP BY exercise`,
      [userId]
    );

    const previousMaxResult = await pool.query(
      `SELECT exercise, MAX(weight) AS max_weight
       FROM workouts
       WHERE user_id = $1
         AND weight IS NOT NULL
         AND date >= NOW() - INTERVAL '60 days'
         AND date < NOW() - INTERVAL '30 days'
       GROUP BY exercise`,
      [userId]
    );

    const recentMap = new Map();
    recentMaxResult.rows.forEach((row) =>
      recentMap.set(row.exercise, parseInt(row.max_weight))
    );

    const previousMap = new Map();
    previousMaxResult.rows.forEach((row) =>
      previousMap.set(row.exercise, parseInt(row.max_weight))
    );

    const progression = [];

    for (const [exercise, recentMax] of recentMap.entries()) {
      const previousMax = previousMap.get(exercise) || 0;
      const change = recentMax - previousMax;

      progression.push({ exercise, change });
    }

    progression.sort((a, b) => b.change - a.change);

    const top3Progression = progression.slice(0, 3);

    /* -------------------------------------------------- */
    /* CONSISTENCY SCORE (last 6 weeks)                   */
    /* -------------------------------------------------- */

    const weeklyCountsResult = await pool.query(
      `SELECT 
          DATE_TRUNC('week', date)::date AS week_start,
          COUNT(*) AS total
       FROM workouts
       WHERE user_id = $1
         AND date >= DATE_TRUNC('week', NOW()) - INTERVAL '5 weeks'
       GROUP BY week_start
       ORDER BY week_start ASC`,
      [userId]
    );

    const weekCountsMap = new Map();
    weeklyCountsResult.rows.forEach((row) => {
      const key = new Date(row.week_start).toISOString().slice(0, 10);
      weekCountsMap.set(key, parseInt(row.total));
    });

    const weeks = [];
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setHours(0, 0, 0, 0);
    const day = currentWeekStart.getDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = (day + 6) % 7;
    currentWeekStart.setDate(currentWeekStart.getDate() - diffToMonday);

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() - i * 7);
      const key = d.toISOString().slice(0, 10);
      const count = weekCountsMap.get(key) || 0;
      weeks.push(count);
    }

    const totalWorkoutsLast6Weeks = weeks.reduce((sum, c) => sum + c, 0);

    let consistencyScore = null;

    if (totalWorkoutsLast6Weeks > 0) {
      const scores = weeks.map((count) => {
        if (count >= 5) return 100;
        if (count >= 3) return 80;
        if (count >= 1) return 50;
        return 0;
      });

      const avgScore =
        scores.reduce((sum, s) => sum + s, 0) / scores.length;

      const roundedScore = Math.round(avgScore);

      let label = "Needs improvement";
      let color = "red";

      if (roundedScore >= 80) {
        label = "Excellent consistency";
        color = "green";
      } else if (roundedScore >= 50) {
        label = "Good consistency";
        color = "yellow";
      }

      consistencyScore = {
        score: roundedScore,
        label,
        color,
      };
    }

    /* -------------------------------------------------- */
    /* EXERCISE VARIETY (last 30 days)                    */
    /* -------------------------------------------------- */

    const varietyResult = await pool.query(
      `SELECT COUNT(DISTINCT exercise) AS unique_exercises
       FROM workouts
       WHERE user_id = $1
         AND date >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    const uniqueExercises = parseInt(
      varietyResult.rows[0].unique_exercises || 0
    );

    let exerciseVariety = null;

    if (uniqueExercises > 0) {
      let score = 40;
      let label = "Low variety";

      if (uniqueExercises >= 8) {
        score = 100;
        label = "Excellent variety";
      } else if (uniqueExercises >= 5) {
        score = 80;
        label = "Good variety";
      } else if (uniqueExercises >= 3) {
        score = 60;
        label = "Moderate variety";
      }

      exerciseVariety = {
        score,
        uniqueExercises,
        label,
      };
    }

    /* -------------------------------------------------- */
    /* WEEKLY STREAK (consecutive active weeks)           */
    /* -------------------------------------------------- */

    const streakWeeksResult = await pool.query(
      `SELECT 
          DATE_TRUNC('week', date)::date AS week_start,
          COUNT(*) AS total
       FROM workouts
       WHERE user_id = $1
       GROUP BY week_start
       ORDER BY week_start ASC`,
      [userId]
    );

    const streakWeekMap = new Map();
    streakWeeksResult.rows.forEach((row) => {
      const key = new Date(row.week_start).toISOString().slice(0, 10);
      streakWeekMap.set(key, parseInt(row.total));
    });

    let weeklyStreak = 0;

    if (streakWeeksResult.rows.length > 0) {
      const nowStreak = new Date();
      const currentWeekStartStreak = new Date(nowStreak);
      currentWeekStartStreak.setHours(0, 0, 0, 0);
      const dayStreak = currentWeekStartStreak.getDay(); // 0=Sun, 1=Mon...
      const diffToMondayStreak = (dayStreak + 6) % 7;
      currentWeekStartStreak.setDate(
        currentWeekStartStreak.getDate() - diffToMondayStreak
      );

      let cursor = new Date(currentWeekStartStreak);

      while (true) {
        const key = cursor.toISOString().slice(0, 10);
        const count = streakWeekMap.get(key) || 0;

        if (count > 0) {
          weeklyStreak += 1;
          cursor.setDate(cursor.getDate() - 7);
        } else {
          break;
        }
      }
    }

    /* -------------------------------------------------- */
    /* WEEKLY VOLUME TREND (last 8 weeks)                 */
    /* -------------------------------------------------- */

    const volumeResult = await pool.query(
      `SELECT 
          DATE_TRUNC('week', date)::date AS week_start,
          COALESCE(SUM(sets * reps * weight), 0) AS total
       FROM workouts
       WHERE user_id = $1
         AND date >= DATE_TRUNC('week', NOW()) - INTERVAL '7 weeks'
       GROUP BY week_start
       ORDER BY week_start ASC`,
      [userId]
    );

    const volumeMap = new Map();
    volumeResult.rows.forEach((row) => {
      const key = new Date(row.week_start).toISOString().slice(0, 10);
      volumeMap.set(key, parseInt(row.total));
    });

    const volumeWeeks = [];
    const currentWeekStartForVolume = new Date(now);
    currentWeekStartForVolume.setHours(0, 0, 0, 0);
    const dayVol = currentWeekStartForVolume.getDay();
    const diffToMondayVol = (dayVol + 6) % 7;
    currentWeekStartForVolume.setDate(
      currentWeekStartForVolume.getDate() - diffToMondayVol
    );

    for (let i = 7; i >= 0; i--) {
      const d = new Date(currentWeekStartForVolume);
      d.setDate(d.getDate() - i * 7);
      const key = d.toISOString().slice(0, 10);
      const total = volumeMap.get(key) || 0;
      volumeWeeks.push({
        weekStart: key,
        total,
      });
    }

    /* FINAL RESPONSE */
    return res.json({
      weeklyTotals,
      monthlyTotals,
      totalWeightThisWeek,
      averageRepsThisWeek,
      lastFiveWorkouts,
      mostCommonExercise,
      monthlyHistory,
      weeklyBreakdown,
      strengthProgression: top3Progression,
      consistencyScore,
      exerciseVariety,
      weeklyVolumeTrend: volumeWeeks,
      weeklyStreak,
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch workout stats" });
  }
});

export default router;
