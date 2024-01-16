import { Express, Request, Response } from 'express';
import { getErrorMessage } from './src/utils/errors.util';
import userRouter from './src/routes/userRoutes';

import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
	res.send('Express + TypeScript Server');
});

app.use('/user', userRouter);

mongoose
	.connect(process.env.MONGO_URL as string)
	.then(() => {
		console.log('[database]: Connected to MongoDB');
		app.listen(port, () => {
			console.log(
				`[server]: Server is running at http://localhost:${port}`
			);
		});
	})
	.catch((error: unknown) => {
		console.log(getErrorMessage(error));
	});
