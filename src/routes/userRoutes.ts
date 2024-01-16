import express, { Router } from 'express';
import { loginOne, registerOne } from '../controllers/userController';

const userRouter: Router = express.Router();

userRouter.post('/login', loginOne);
userRouter.post('/register', registerOne);

export default userRouter;
