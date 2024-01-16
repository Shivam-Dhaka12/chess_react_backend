import { Request, Response } from 'express';
import { getErrorMessage } from '../utils/errors.util';
import { IUser, User } from '../models/userModel';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// import * as userServices from '../services/user.service';
// import { CustomRequest } from '../middleware/auth';

export const loginOne = async (req: Request, res: Response) => {
	try {
		console.log(req.body);
		const foundUser = await User.findOne({
			username: req.body.username,
		});
		if (foundUser) {
			const isMatch = bcrypt.compareSync(
				req.body.password,
				foundUser.password
			);

			if (isMatch) {
				const token = jwt.sign(
					{ _id: foundUser?._id, username: foundUser?.username },
					process.env.JWT_SECRET as string,
					{
						expiresIn: '1d',
					}
				);
				return res.status(200).json({
					status: 200,
					message: 'Logged in successfully as: ' + foundUser.username,
					token,
				});
			}
		}
		return res.status(403).send('Invalid Username or Password');
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
