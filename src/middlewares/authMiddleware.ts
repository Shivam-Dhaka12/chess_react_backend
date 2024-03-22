import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const protectedController = (
	req: Request,
	res: Response,
	next: () => void
) => {
	const token: string = req.headers.token as string;
	if (token) {
		try {
			const decode = jwt.verify(token, process.env.JWT_SECRET as string);
			req.body.decoded = decode;
			next();
		} catch (error) {
			return res.status(403).json({
				success: false,
				message: 'Invalid JWT Token',
			});
		}
	} else {
		return res.status(403).json({
			success: false,
			message: 'No token provided',
		});
	}
};
