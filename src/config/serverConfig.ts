import dotenv from 'dotenv';

dotenv.config();

const serverConfig = {
	PORT: process.env.PORT || 8040,
	JWT_SECRET: process.env.JWT_SECRET,
	MONGO_URL: process.env.MONGO_URL,
	DB_NAME: process.env.DB_NAME,
};

export default serverConfig;
