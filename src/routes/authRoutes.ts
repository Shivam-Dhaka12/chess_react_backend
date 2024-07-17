import express, { Router } from 'express';
import { signin, signup, guestSignin } from '../controllers/authController';

const authRouter: Router = express.Router();

authRouter.post('/signin', signin);
authRouter.post('/signup', signup);
authRouter.post('/guest-signin', guestSignin);

export default authRouter;
