import { Request, Response } from 'express';
import { getErrorMessage } from '../utils/errors.util';
import { IUser, User } from '../models/userModel';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import serverConfig from '../config/serverConfig';
// import * as userServices from '../services/user.service';
// import { CustomRequest } from '../middleware/auth';
const { JWT_SECRET } = serverConfig;

export const signin = async (req: Request, res: Response) => {
	try {
		const { username, password } = req.body;

		//CHECK IF DATA EXISTS
		if (!username || !password) {
			return res.status(404).json({
				message: 'Both username and password are required for login',
				success: false,
			});
		}
		const foundUser = await User.findOne({
			username,
		});
		if (foundUser) {
			const isMatch = bcrypt.compareSync(password, foundUser.password);

			if (isMatch) {
				const token = jwt.sign(
					{ _id: foundUser?._id, email: foundUser?.email },
					JWT_SECRET as string,
					{
						expiresIn: '1d',
					}
				);
				return res.status(200).json({
					message: `Logged in successfully as: ${foundUser.username}`,
					success: true,
					username: foundUser.username,
					token,
				});
			} else {
				return res.status(403).json({
					message: 'Invalid Password',
					success: false,
				});
			}
		}
		return res.status(403).json({
			message: `No user with the username : ${username}`,
			success: false,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({
			message: getErrorMessage(error),
			success: false,
		});
	}
};

export const signup = async (req: Request, res: Response) => {
	try {
		const { username, password } = req.body;

		//CHECK IF DATA EXISTS
		if (!username || !password) {
			return res.status(404).json({
				message:
					'Both username and password are required for the registration',
				success: false,
			});
		}

		//CHECK IF USER ALREADY EXISTS
		const userAlreadyRegistered = await User.findOne({ username });
		if (userAlreadyRegistered) {
			return res.status(404).json({
				message: 'username already taken',
				success: false,
			});
		}

		//REGISTER AND SAVE THE USER
		const user = new User<IUser>({
			username,
			password,
		});
		console.log(user);
		const newUser = await user.save();
		return res.status(200).json({
			message: 'User registration successfully done!!',
			success: true,
		});
	} catch (error) {
		return res.status(500).json({
			message: getErrorMessage(error),
			success: false,
		});
	}
};
