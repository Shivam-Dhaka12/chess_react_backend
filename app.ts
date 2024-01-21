import { Express, Request, Response } from 'express';
import userRouter from './src/routes/userRoutes';
import protectedRouter from './src/routes/someProtectedRoutes';

import express from 'express';
import { connectToDB } from './src/database/db';
import serverConfig from './src/config/serverConfig';

import http from 'http';
import { Server, Socket } from 'socket.io';

const { PORT } = serverConfig;

const cors = require('cors');

const setupExpressApp = (): Express => {
	const app: Express = express();

	app.use(cors());
	app.use(express.json());

	app.get('/', (req: Request, res: Response) => {
		console.log(req.headers);
		res.send('Express + TypeScript Server');
	});

	app.use('/user', userRouter);
	app.use('/protected', protectedRouter);

	return app;
};

const startSocketServer = (server: http.Server): Server => {
	const io = new Server(server, {
		cors: {
			origin: '*',
		},
	});

	io.on('connection', (socket: Socket) => {
		console.log('A user connected');

		socket.on('message', (msg: string) => {
			console.log(`Message from ${socket.id}: ${msg}`);
			io.emit('message', msg);
		});

		socket.on('disconnect', () => {
			console.log('User disconnected');
		});
	});

	return io;
};

const serverStart = async () => {
	await connectToDB();

	const app: Express = setupExpressApp();
	const server = http.createServer(app);
	startSocketServer(server);

	server.listen(PORT, async () => {
		console.log(`[server]: Server is running at http://localhost:${PORT}`);
	});
};

serverStart();
