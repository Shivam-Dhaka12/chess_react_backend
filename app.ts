import { Express, Request, Response } from 'express';
import { getErrorMessage } from './src/utils/errors.util';
import userRouter from './src/routes/userRoutes';
import protectedRouter from './src/routes/someProtectedRoutes';

import express from 'express';
import { connectToDB } from './src/database/db';
import serverConfig from './src/config/serverConfig';

const {PORT} = serverConfig

const cors = require('cors');

const serverStart = async()=>{
await connectToDB();
const app: Express = express();

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
	res.send('Express + TypeScript Server');
});

app.use('/user', userRouter);
app.use('/protected', protectedRouter);

	app.listen(PORT, async() => {
		console.log(
				`[server]: Server is running at http://localhost:${PORT}`
			);
		});
	
}


serverStart();