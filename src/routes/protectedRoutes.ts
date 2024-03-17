import express, { Router } from 'express';
import { protectedController } from '../controllers/protectedController';

const protectedRouter: Router = express.Router();

protectedRouter.get('/protected', protectedController);
export default protectedRouter;
