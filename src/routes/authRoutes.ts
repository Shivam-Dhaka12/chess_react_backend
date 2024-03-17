import express, { Router } from 'express';
import { signin, signup } from '../controllers/authController';

const authRouter: Router = express.Router();

authRouter.post('/signin', signin);
authRouter.post('/signup', signup);

export default authRouter;
