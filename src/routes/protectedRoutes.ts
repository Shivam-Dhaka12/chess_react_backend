import express, { Router } from 'express';
import { logout } from '../controllers/authController';

const protectedRouter: Router = express.Router();

protectedRouter.post('/logout', logout);
export default protectedRouter;
