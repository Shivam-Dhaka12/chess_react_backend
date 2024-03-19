import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import http from 'http';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

interface ActiveUsers {
	[roomId: string]: {
		username: string;
		room: string | null;
		disconnected: boolean;
	};
}

interface ActiveRooms {
	[roomId: string]: string[];
}

const activeUsers: ActiveUsers = {}; // Object to store active user state
const activeRooms: ActiveRooms = {};

const startSocketServer = (server: http.Server): Server => {
	const io = new Server(server, {
		cors: {
			origin: '*',
		},
	});

	// auth middleware
	io.use((socket: Socket, next) => {
		const token = socket.handshake.auth.token;
		jwt.verify(
			token,
			process.env.JWT_SECRET as string,
			(err: any, decoded: any) => {
				if (err) {
					return next(new Error('Authentication error'));
				}

				console.log(decoded, decoded.username);
				// @ts-ignore
				socket.decoded = decoded.username;
			}
		);
		next();
	});

	//
	io.on('connection', (socket: Socket) => {
		console.log('A user connected: ' + socket.id);
		// @ts-ignore
		const username = socket?.decoded.username;
		console.log('Username: ' + username);

		activeUsers[socket.id] = {
			username: username || 'Anonymous',
			room: null,
			disconnected: false,
		};

		socket.on('room-create', (roomId, next) => {
			socket.join(roomId);
			// Add user to the room's user list and Update activeUser to include its room
			if (activeRooms[roomId]) {
				next(new Error('A room with this name already exists'));
			}
			activeRooms[roomId] = [socket.id];
			activeUsers[socket.id].room = roomId;
		});

		socket.on('room-join', (roomId, next) => {
			if (!activeRooms[roomId]) {
				return next(new Error('Room does not exist'));
			}

			if (activeRooms[roomId].length >= 2) {
				return next(new Error('Room is full'));
			}

			socket.join(roomId);
			activeRooms[roomId].push(socket.id);
			activeUsers[socket.id].room = roomId;

			io.to(roomId).emit('player-connect', username); // Emit room information to all users in the room
		});

		socket.on('disconnect', () => {
			const user = activeUsers[socket.id];
			if (user && user.room) {
				user.disconnected = true;
				io.to(user.room).emit('player-reconnecting', user.username);
				// Set a timer to automatically remove the user if they don't reconnect within the specified timeframe
				setTimeout(() => {
					if (activeUsers[socket.id].disconnected) {
						if (user.room) {
							activeRooms[user.room] = activeRooms[
								user.room
							].filter(
								(username: string) => username !== user.username
							);
							socket.leave(user.room);
							io.to(user.room).emit(
								'player-disconnect',
								user.username
							);
							if (activeRooms[user.room].length === 0) {
								delete activeRooms[user.room]; // Delete the room if there are no users left
							}
						}

						delete activeUsers[socket.id];
					}
				}, 30000); // 30 seconds timeout
			}
		});

		socket.on('reconnectAttempt', () => {
			const user = activeUsers[socket.id];
			if (user && user.disconnected) {
				// Attempt to rejoin the game room
				if (user.room) {
					socket.join(user.room);
					io.to(user.room).emit('player-reconnect', user.username);
					user.disconnected = false;
				}
			}
		});
	});

	return io;
};

export default startSocketServer;
