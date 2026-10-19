
import { MongoClient } from "mongodb";
import process from "node:process";

let client;
let connectedStore;

export function getMongoUri(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Add your MongoDB connection string to the .env file."
    );
  }

  if (/YOUR_CLUSTER|<[^>]+>/i.test(uri)) {
    throw new Error(
      "MONGODB_URI still contains an example placeholder. Copy the connection string from MongoDB Atlas and replace the placeholders."
    );
  }

  return uri;
}

export function getMongoDatabaseName(
  uri,
  databaseName = process.env.MONGODB_DB
) {
  const uriDatabaseName = decodeURIComponent(
    new URL(uri).pathname.slice(1)
  );

  return databaseName || uriDatabaseName || "ethio_crop_advisor";
}

export function createRecommendationStore(collection) {
  return {
    async save(response) {
      const createdAt = new Date();

      const result = await collection.insertOne({
        createdAt,
        response,
      });

      return {
        id: result.insertedId.toString(),
        createdAt: createdAt.toISOString(),
      };
    },

    async listRecent(limit = 50) {
      const records = await collection
        .find({})
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .toArray();

      return records.map(({ _id, createdAt, response }) => ({
        id: _id.toString(),
        createdAt: createdAt.toISOString(),
        ...response,
      }));
    },
  };
}

export const recommendationStore = {
  async save(response) {
    if (!connectedStore) {
      throw new Error("MongoDB is not connected.");
    }

    return connectedStore.save(response);
  },

  async listRecent(limit = 50) {
    if (!connectedStore) {
      throw new Error("MongoDB is not connected.");
    }

    return connectedStore.listRecent(limit);
  },
};

export async function connectDatabase() {
  if (connectedStore) {
    return connectedStore;
  }

  const uri = getMongoUri();

  // Diagnostic setting: prefer IPv4 for the connection.
  const nextClient = new MongoClient(uri, {
    family: 4,
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  await nextClient.connect();

  try {
    const databaseName = getMongoDatabaseName(uri);
    const collection = nextClient
      .db(databaseName)
      .collection("recommendation_history");

    await collection.createIndex({ createdAt: -1 });

    connectedStore = createRecommendationStore(collection);
    client = nextClient;

    console.log(`MongoDB connected successfully. Database: ${databaseName}`);

    return connectedStore;
  } catch (error) {
    await nextClient.close();
    throw error;
  }
}

export async function closeDatabase() {
  if (client) {
    await client.close();
  }

  client = undefined;
  connectedStore = undefined;
}
