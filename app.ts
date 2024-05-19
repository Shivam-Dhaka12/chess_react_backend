import { Express, NextFunction, Request, Response } from 'express';
import authRouter from './src/routes/authRoutes';
import protectedRouter from './src/routes/protectedRoutes';

import { connectToDB } from './src/database/db';
import serverConfig from './src/config/serverConfig';
import startSocketServer from './socket';
import express from 'express';
import http from 'http';
import morgan from 'morgan';
import cors from 'cors';

import { protectedController } from './src/middlewares/authMiddleware';

const { PORT } = serverConfig;
const logCorsErrors = (req: Request, res: Response, next: NextFunction) => {
	res.on('finish', () => {
		if (res.statusCode >= 400 && res.statusCode < 600) {
			console.error(
				`CORS Error: ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`
			);
		}
	});
	next();
};
const setupExpressApp = (): Express => {
	const app: Express = express();
	app.use(cors());
	app.use(logCorsErrors);
	app.use(express.json());
	app.use(morgan('dev'));
	app.get('/', (req: Request, res: Response) => {
		res.send('Express + TypeScript Server');
	});

	app.use('/api/auth', authRouter);
	app.use('/api/protected', protectedController, protectedRouter);

	return app;
};

const serverStart = async () => {
	await connectToDB();

	const app: Express = setupExpressApp();
	const server = http.createServer(app);
	const io = startSocketServer(server);

	server.listen(PORT, async () => {
		console.log(`[server]: Server is running at http://localhost:${PORT}`);
	});

	return { app, io };
};

serverStart();
