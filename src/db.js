import pkg from "pg";
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "fitnessprogressor",
        password: "password",
        port: 5432,
      }
);

export default pool;
