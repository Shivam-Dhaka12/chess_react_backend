import mongoose from 'mongoose';

export interface IUser {
	username: string;
	email?: string;
	password: string;
	date?: Date;
}

const userSchema = new mongoose.Schema<IUser>({
	username: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: false,
	},
	password: {
		type: String,
		required: true,
	},
	date: {
		type: Date,
		default: Date.now,
	},
});

export const User = mongoose.model<IUser>('User', userSchema);
