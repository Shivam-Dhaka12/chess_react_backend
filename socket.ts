import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import http from 'http';

interface ActiveUsers {
	[userId: string]: {
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
	let timer: NodeJS.Timeout;

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
					'===============',
					'\n',
					'JWT decoded \n================> \n',
					'decoded: ' + JSON.stringify(decoded),
					'\n',
					'username: ' + decoded?.username,
					'\n',
					'==============='
				);
				// @ts-ignore
				socket.decoded = { ...decoded };
			}
		);
		next();
	});

	const handleError = (socket: Socket, error: Error) => {
		console.log(error.message);
		io.to(socket.id).emit('error', { message: error.message });
	};
	//
	io.on('connection', (socket: Socket) => {
		console.log('A user connected: ' + socket.id);
		// @ts-ignore
		const { username, _id } = socket?.decoded || {};

		if (!activeUsers[_id]) {
			console.log('username: ' + username);

			activeUsers[_id] = {
				username,
				room: null,
				disconnected: false,
			};
		} else {
			if (timer) clearTimeout(timer);
			activeUsers[_id].disconnected = false;

			if (activeUsers[_id]) {
				const roomId = activeUsers[_id].room;
				if (roomId) {
					socket.join(roomId);
					io.to(roomId).emit(
						'room-joined',
						`${username} reconnected`
					);
				}
			}
		}
		//vREview this!!!!!!!!!!!!!
		activeConnections[_id] = socket;

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

			activeRooms[roomId] = [_id];
			activeUsers[_id].room = roomId;

			io.to(roomId).emit('room-created', roomId);
		});

		socket.on('room-join', (roomId) => {
			if (!activeRooms[roomId]) {
				console.log('recieved event room join');
				handleError(socket, new Error('Room does not exist'));
				return;
			}
			console.log('========================');
			console.log('Already active?', activeUsers[_id]);
			//check if user is already in the any room
			if (activeUsers[_id].room) {
				//if already in the room
				if (activeUsers[_id].room === roomId) {
					io.to(roomId).emit(
						'room-joined',
						`${username} reconnected`
					);
				} else {
					handleError(
						socket,
						new Error(
							`Already in a room, wait 30s or first leave the room ${activeUsers[_id].room}`
						)
					);
				}
				return;
			}

			if (activeRooms[roomId].length >= 2) {
				handleError(socket, new Error('Room is full'));
				return;
			}
			socket.join(roomId);
			activeRooms[roomId].push(_id);
			activeUsers[_id].room = roomId;
			console.log('After joinging room ' + roomId);
			console.log(_id, activeUsers[_id]);

			io.to(roomId).emit(
				'room-joined',
				`${username} joined the room ${roomId}`
			); // Emit room information to all users in the room
		});

		socket.on('make-move', ({ move, roomId }) => {
			console.log('Player move: ' + move);
			io.to(roomId).emit('player-move', move);
		});

		socket.on('disconnect', () => {
			console.log('User lost connection: ' + _id);
			const user = activeUsers[_id];
			if (user && user.room) {
				user.disconnected = true;
				io.to(user.room).emit(
					'player-reconnecting',
					`${user.username} reconnecting...`
				);
				// Set a timer to automatically remove the user if they don't reconnect within the specified timeframe
				timer = setTimeout(() => {
					if (activeUsers[_id].disconnected) {
						if (user.room) {
							activeRooms[user.room] = activeRooms[
								user.room
							].filter((userId: string) => userId !== _id);

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

						delete activeUsers[_id];
					}
				}, 30000); // 30 seconds timeout
			}
		});
	});

	return io;
};

export default startSocketServer;
