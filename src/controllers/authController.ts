import { Request, Response } from 'express';
import { getErrorMessage } from '../utils/errors.util';
import { User } from '../models/userModel';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import serverConfig from '../config/serverConfig';
import { activeConnections } from '../../socket';
import { token } from 'morgan';

const { JWT_SECRET } = serverConfig;

export const signin = async (req: Request, res: Response) => {
	try {
		let { username, password } = req.body;
		//CHECK IF DATA EXISTS
		if (!username || !password) {
			return res.status(404).json({
				message: 'Both username and password are required for login',
				success: false,
			});
		}

		username = username.trim();
		username = username.toLowerCase();

		const foundUser = await User.findOne({
			username,
		});
		if (foundUser) {
			const isMatch = bcrypt.compareSync(password, foundUser.password);

			if (isMatch) {
				console.log('===============================================');
				console.log('Logged in successfully as:', foundUser.username);
				const token = jwt.sign(
					{ username: foundUser.username, _id: foundUser._id },
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
					wins: foundUser.wins,
					losses: foundUser.losses,
					draws: foundUser.draws,
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

		username.trim();
		username.toLowerCase();
		//CHECK IF USER ALREADY EXISTS
		const userAlreadyRegistered = await User.findOne({ username });
		if (userAlreadyRegistered) {
			return res.status(404).json({
				message: 'username already taken',
				success: false,
			});
		}

		//REGISTER AND SAVE THE USER
		const user = new User();
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

export const guestSignin = async (req: Request, res: Response) => {
	try {
		const guestToken = generateGuestToken();
		console.log('Guest token: ', guestToken);

		return res.status(200).json({
			message: `Logged in successfully as a guest`,
			success: true,
			username: guestToken,
			token: guestToken,
			wins: 0,
			losses: 0,
			draws: 0,
		});
	} catch (error) {
		res.status(204).json({
			success: false,
			message: 'Guest login failed, try later.',
		});
	}
};

export const logout = async (req: Request, res: Response) => {
	const userId = req.body.decoded._id;
	console.log('UserId', userId);
	// Find the Socket.io connection associated with the user's session
	const socket = activeConnections[userId];
	if (socket) {
		socket.disconnect(true);
		console.log(
			`User ${userId} logged out and Socket.io connection closed`
		);
		res.status(200).json({
			success: true,
			message: 'User logged out successfully',
		});
		delete activeConnections[userId];
	} else {
		console.log(`User ${userId} not found or already disconnected`);
		res.status(204).json({
			success: false,
			message: 'User not found or already disconnected',
		});
	}
};
function generateGuestToken() {
	return 'GUEST_' + Math.random().toString(16) + Date.now().toString(16);
}
