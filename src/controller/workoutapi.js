import pool from "../db.js";

export const  DeleteWorkout= async (req, res) => {
  try {
    const userId = req.userId;
    const workoutId = req.params.id;

    const result = await pool.query(
      "DELETE FROM workouts WHERE id = $1 AND user_id = $2 RETURNING id",
      [workoutId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Workout not found",
      });
    }

    res.status(200).json({
      message: "Workout deleted successfully",
      deletedId: result.rows[0].id,
    });

  } catch (err) {
    console.error("Delete error:", err);

    res.status(500).json({
      message: err.message || "Delete failed",
    });
  }
};