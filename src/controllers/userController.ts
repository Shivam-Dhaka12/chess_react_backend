import { Request, Response } from 'express';
import { getErrorMessage } from '../utils/errors.util';
import { HydratedDocument } from 'mongoose';
import { IUser, User } from '../models/userModel';
// import * as userServices from '../services/user.service';
// import { CustomRequest } from '../middleware/auth';

export const loginOne = async (req: Request, res: Response) => {
	try {
		console.log(req.body);
		res.status(200).send('Login Route');
	} catch (error) {
		return res.status(500).send(getErrorMessage(error));
	}
};

export const registerOne = async (req: Request, res: Response) => {
	try {
		const user = new User<IUser>({
			username: req.body.username,
			password: req.body.password,
		});
		const newUser = await user.save();
		res.status(200).send(newUser);
	} catch (error) {
		return res.status(500).send(getErrorMessage(error));
	}
};
