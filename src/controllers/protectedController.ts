import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const protectedController = (req: Request, res: Response) => {
	const token: string = req.headers.token as string;
	if (token) {
		try {
			const decode = jwt.verify(token, process.env.JWT_SECRET as string);
			return res.status(200).json({
				status: 200,
				message: 'success',
			});
		} catch (error) {
			return res.status(403).send('Invalid JWT Token');
		}
	}
	return res.status(403).send('Missing JWT Token');
};
