import mongoose from "mongoose";
import serverConfig from "../config/serverConfig";

const { MONGO_URL } = serverConfig;

export const connectToDB = async () => {
  try {
    if (MONGO_URL) {
      const connection = await mongoose.connect(MONGO_URL);
    //   console.log(`CONNECTED TO DB `, connection);
      console.log(`CONNECTED TO DB `);
      return connection;
    }
  } catch (error) {
    console.error("ERROR WHILE CONNECTING TO DB", error);
    throw error;
  }
};
