import mongoose from 'mongoose';
import serverConfig from '../config/serverConfig';

const { MONGO_URL, DB_NAME } = serverConfig;

export const connectToDB = async () => {
	try {
		if (MONGO_URL) {
			const connection = await mongoose.connect(MONGO_URL, {
				dbName: DB_NAME, // Specify the database name
			});
			console.log(`Connected to MongoDB Atlas: ${DB_NAME}`);
			return connection;
		}
	} catch (error) {
		console.error('ERROR WHILE CONNECTING TO DB', error);
		throw error;
	}
};
