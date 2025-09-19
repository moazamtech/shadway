import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }

  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  }

  const db = client.db('shadcn-hub');
  return { client, db };
}