import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DATABASE_PATH
  ? resolve(process.env.DATABASE_PATH)
  : resolve(serverDirectory, "data", "ethio-crop-advisor.sqlite");

mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE IF NOT EXISTS recommendation_history (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    response_json TEXT NOT NULL
  )
`);

const insertRecommendation = database.prepare(`
  INSERT INTO recommendation_history (created_at, response_json)
  VALUES (?, ?)
`);
const selectRecentRecommendations = database.prepare(`
  SELECT id, created_at, response_json
  FROM recommendation_history
  ORDER BY id DESC
  LIMIT ?
`);

export function saveRecommendation(response) {
  const createdAt = new Date().toISOString();
  const result = insertRecommendation.run(createdAt, JSON.stringify(response));
  return { id: Number(result.lastInsertRowid), createdAt };
}

export function listRecentRecommendations(limit = 50) {
  return selectRecentRecommendations.all(limit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    ...JSON.parse(row.response_json),
  }));
}

export function closeDatabase() {
  database.close();
}
