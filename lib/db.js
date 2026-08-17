const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'cinesubz';

if (!uri) {
  console.warn('[db] MONGODB_URI is not set. Database features will fail until it is configured.');
}

// Reuse the client across warm serverless invocations instead of reconnecting every request.
let cachedClient = global._cinesubzMongoClient;
let cachedPromise = global._cinesubzMongoPromise;

async function getDb() {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  if (cachedClient && cachedClient.topology && cachedClient.topology.isConnected()) {
    return cachedClient.db(dbName);
  }
  if (!cachedPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
    });
    cachedPromise = client.connect().then((c) => {
      cachedClient = c;
      global._cinesubzMongoClient = c;
      global._cinesubzMongoPromise = cachedPromise;
      return c;
    });
    global._cinesubzMongoPromise = cachedPromise;
  }
  const client = await cachedPromise;
  return client.db(dbName);
}

module.exports = { getDb };
