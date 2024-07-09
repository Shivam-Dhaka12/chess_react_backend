import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends mongoose.Document {
	username: string;
	wins: number;
	losses: number;
	draws: number;
	password: string;
	email?: string;
	date?: Date;
}

const userSchema = new mongoose.Schema<IUser>({
	username: {
		type: String,
		required: true,
		unique: true,
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
	wins: {
		type: Number,
		default: 0,
	},
	losses: {
		type: Number,
		default: 0,
	},
	draws: {
		type: Number,
		default: 0,
	},
});

const saltRounds = 12;

userSchema.pre('save', async function (next) {
	const user = this;
	if (user.isModified('password')) {
		user.password = await bcrypt.hash(user.password, saltRounds);
	}
	next();
});

export const User = mongoose.model<IUser>('User', userSchema);
