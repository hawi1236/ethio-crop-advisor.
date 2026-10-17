import assert from "node:assert/strict";
import { test } from "node:test";
import { createRecommendationStore, getMongoDatabaseName, getMongoUri } from "./database.js";

test("MongoDB setup identifies the copied Atlas placeholder", () => {
  assert.throws(
    () => getMongoUri("mongodb+srv://user:password@YOUR_CLUSTER.mongodb.net/"),
    /still contains an example placeholder/,
  );
});

test("MongoDB database name uses the URI database unless explicitly overridden", () => {
  const uri = "mongodb+srv://user:password@cluster.example.net/ethio_crop_db?retryWrites=true";
  assert.equal(getMongoDatabaseName(uri, ""), "ethio_crop_db");
  assert.equal(getMongoDatabaseName(uri, "custom_db"), "custom_db");
  assert.equal(getMongoDatabaseName("mongodb://localhost:27017", ""), "ethio_crop_advisor");
});

test("MongoDB recommendation store saves and maps records", async () => {
  let insertedDocument;
  const storedAt = new Date("2026-10-17T11:00:00.000Z");
  const collection = {
    async insertOne(document) {
      insertedDocument = document;
      return { insertedId: { toString: () => "mongo-id-1" } };
    },
    find(filter) {
      assert.deepEqual(filter, {});
      return {
        sort(sortOrder) {
          assert.deepEqual(sortOrder, { createdAt: -1, _id: -1 });
          return this;
        },
        limit(limit) {
          assert.equal(limit, 50);
          return this;
        },
        async toArray() {
          return [{
            _id: { toString: () => "mongo-id-1" },
            createdAt: storedAt,
            response: { context: { location: "Bishoftu" } },
          }];
        },
      };
    },
  };
  const store = createRecommendationStore(collection);

  const saved = await store.save({ context: { location: "Bishoftu" } });
  assert.equal(saved.id, "mongo-id-1");
  assert.ok(Number.isFinite(Date.parse(saved.createdAt)));
  assert.deepEqual(insertedDocument.response, { context: { location: "Bishoftu" } });
  assert.ok(insertedDocument.createdAt instanceof Date);

  assert.deepEqual(await store.listRecent(), [{
    id: "mongo-id-1",
    createdAt: storedAt.toISOString(),
    context: { location: "Bishoftu" },
  }]);
});
