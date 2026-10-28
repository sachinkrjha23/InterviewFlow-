import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;

export const startDb = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
};

export const clearDb = async () => {
  const cols = Object.values(mongoose.connection.collections);
  await Promise.all(cols.map((c) => c.deleteMany({})));
};

export const stopDb = async () => {
  await mongoose.disconnect();
  await mongod?.stop();
};
