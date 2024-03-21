import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import http from 'http';

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
			credentials: true,
		},
	});

	// auth middleware
	io.use((socket: Socket, next) => {
		const token = socket.handshake.auth.token;
		console.log('token: ', token);
		jwt.verify(
			token,
			process.env.JWT_SECRET as string,
			(err: any, decoded: any) => {
				if (err) {
					return next(new Error('Authentication error'));
				}

				console.log(decoded, decoded?.email);
				// @ts-ignore
				socket.decoded = decoded?.email || 'Anonymous';
			}
		);
		next();
	});

	const handleError = (socket: Socket, error: Error) => {
		socket.emit('error', { message: error.message });
	};
	//
	io.on('connection', (socket: Socket) => {
		console.log('A user connected: ' + socket.id);
		// @ts-ignore
		const email = socket?.decoded?.email || 'Anonymous';
		console.log('email: ' + email);

		activeUsers[socket.id] = {
			username: 'Anonymous',
			room: null,
			disconnected: false,
		};

		socket.on('room-create', (roomId) => {
			console.log('inside room create');
			socket.join(roomId);
			console.log('Room created: ' + roomId);
			// Add user to the room's user list and Update activeUser to include its room
			if (activeRooms[roomId]) {
				handleError(
					socket,
					new Error('A room with this name already exists')
				);
				return;
			}
			activeRooms[roomId] = [socket.id];
			activeUsers[socket.id].room = roomId;

			io.to(roomId).emit('room-created', roomId);
		});

		socket.on('room-join', (roomId) => {
			if (!activeRooms[roomId]) {
				handleError(socket, new Error('Room does not exist'));
				return;
			}

			if (activeRooms[roomId].length >= 2) {
				handleError(socket, new Error('Room is full'));
				return;
			}

			socket.join(roomId);
			activeRooms[roomId].push(socket.id);
			activeUsers[socket.id].room = roomId;

			io.to(roomId).emit('player-connect', email); // Emit room information to all users in the room
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
