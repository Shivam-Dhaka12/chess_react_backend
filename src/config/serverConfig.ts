import dotenv from "dotenv";

dotenv.config();

const serverConfig={
    PORT: process.env.PORT||5000,
    JWT_SECRET:process.env.JWT_SECRET,
    MONGO_URL:process.env.MONGO_URL
}



export default serverConfig;