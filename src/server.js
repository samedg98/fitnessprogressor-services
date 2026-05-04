import pg from "pg";
pg.types.setTypeParser(1082, (val) => val); // return DATE as string

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// CORS — allow localhost + Netlify + Vercel production domain
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://delicate-liger-d20157.netlify.app",
      "https://fitnessprogressor-ui.vercel.app"   
    ],
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  })
);

app.use(express.json());

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
import authRoutes from "./routes/auth.js";
import workoutRoutes from "./routes/workouts.js";

app.use("/auth", authRoutes);
app.use("/workouts", workoutRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
