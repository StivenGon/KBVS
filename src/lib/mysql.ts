import mysql from "mysql2/promise";

const defaultConfig = {
  host: process.env.MYSQL_HOST ?? "localhost",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "123456",
  database: process.env.MYSQL_DATABASE ?? "kbvs",
  connectionLimit: 5,
  charset: "utf8mb4",
};

const globalForMySql = globalThis as typeof globalThis & {
  kbvsMySqlPool?: mysql.Pool;
};

export function getMySqlPool() {
  if (!globalForMySql.kbvsMySqlPool) {
    globalForMySql.kbvsMySqlPool = mysql.createPool(defaultConfig);
  }

  return globalForMySql.kbvsMySqlPool;
}
