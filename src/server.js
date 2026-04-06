import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
import authRoutes from "./routes/auth.js";
import workoutRoutes from "./routes/workouts.js";

app.use("/auth", authRoutes);
app.use("/workouts", workoutRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
