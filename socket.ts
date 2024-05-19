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

interface activeConnections {
	[userId: string]: Socket;
}

const activeUsers: ActiveUsers = {}; // Object to store active user state
const activeRooms: ActiveRooms = {};
export const activeConnections: activeConnections = {};

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
		jwt.verify(
			token,
			process.env.JWT_SECRET as string,
			(err: any, decoded: any) => {
				if (err) {
					return next(new Error('Authentication error'));
				}

				console.log(
					'decoded: ' + JSON.stringify(decoded),
					'\n',
					'username: ' + decoded?.username
				);
				// @ts-ignore
				socket.decoded = { ...decoded };
			}
		);
		next();
	});

	const handleError = (socket: Socket, error: Error) => {
		console.log('inside error');
		console.log(error.message);
		io.to(socket.id).emit('error', { message: error.message });
	};
	//
	io.on('connection', (socket: Socket) => {
		console.log('A user connected: ' + socket.id);

		// @ts-ignore
		const { username, _id } = socket?.decoded || {};
		activeConnections[_id] = socket;

		console.log('username: ' + username);

		activeUsers[socket.id] = {
			username,
			room: null,
			disconnected: false,
		};

		socket.on('room-create', (roomId) => {
			// Add user to the room's user list and Update activeUser to include its room
			if (activeRooms[roomId]) {
				handleError(
					socket,
					new Error('A room with this name already exists')
				);
				return;
			}

			socket.join(roomId);
			console.log('Room created: ' + roomId);

			activeRooms[roomId] = [socket.id];
			activeUsers[socket.id].room = roomId;

			io.to(roomId).emit('room-created', roomId);
		});

		socket.on('room-join', (roomId) => {
			if (!activeRooms[roomId]) {
				console.log('recieved event room join');
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

			io.to(roomId).emit(
				'room-joined',
				`${username} joined the room ${roomId}`
			); // Emit room information to all users in the room
		});

		socket.on('disconnect', () => {
			console.log('User lost connection: ' + socket.id);
			const user = activeUsers[socket.id];
			if (user && user.room) {
				user.disconnected = true;
				io.to(user.room).emit(
					'player-reconnecting',
					`${user.username} reconnecting...`
				);
				// Set a timer to automatically remove the user if they don't reconnect within the specified timeframe
				setTimeout(() => {
					if (activeUsers[socket.id].disconnected) {
						if (user.room) {
							activeRooms[user.room] = activeRooms[
								user.room
							].filter(
								(socketId: string) => socketId !== socket.id
							);

							socket.leave(user.room);
							console.log('User left room: ' + user.room);
							io.to(user.room).emit(
								'player-disconnect',
								`${user.username} disconnected`
							);
							if (activeRooms[user.room].length === 0) {
								delete activeRooms[user.room]; // Delete the room if there are no users left
								console.log('Room deleted: ' + user.room);
							}
						}

						delete activeUsers[socket.id];
					}
				}, 30000); // 30 seconds timeout
			}
		});

		socket.on('reconnect-attempt', () => {
			const user = activeUsers[socket.id];
			if (user && user.disconnected) {
				// Attempt to rejoin the game room
				if (user.room) {
					io.to(user.room).emit(
						'player-reconnect',
						`${user.username} reconnected`
					);
					user.disconnected = false;
				}
			} else {
				io.to(socket.id).emit(
					'reconnect-gameover',
					'Game is already over'
				);
			}
		});
	});

	return io;
};

export default startSocketServer;
