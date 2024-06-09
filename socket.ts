import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import http from 'http';

interface User {
	username: string;
	room: string | null;
	disconnected: boolean;
	isFirstConnection: boolean;
	activeInRoom: boolean;
}
interface ActiveUsers {
	[userId: string]: User;
}

interface ActiveRooms {
	[roomId: string]: string[];
}

interface ActiveConnections {
	[userId: string]: Socket;
}

const activeUsers: ActiveUsers = {}; // Object to store active user state
const activeRooms: ActiveRooms = {};
export const activeConnections: ActiveConnections = {};

const startSocketServer = (server: http.Server): Server => {
	let connectionTimer: NodeJS.Timeout;
	let roomTimer: NodeJS.Timeout;

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
				// @ts-ignore
				socket.decoded = { ...decoded };
			}
		);
		next();
	});

	const handleError = (socket: Socket, error: Error) => {
		console.log('Error: ' + error.message);
		io.to(socket.id).emit('error', { message: error.message });
	};
	//
	io.on('connection', (socket: Socket) => {
		// @ts-ignore
		const { username, _id } = socket?.decoded || {};
		console.log('A user connected: ' + _id);

		if (activeUsers[_id]) {
			if (connectionTimer) clearTimeout(connectionTimer);
			activeUsers[_id].disconnected = false;

			socket.on('is-reconnecting', (roomId: string) => {
				//
				if (activeUsers[_id] && activeUsers[_id].isFirstConnection) {
					activeUsers[_id].isFirstConnection = false;
					return;
				}
				if (activeUsers[_id] && activeUsers[_id].room !== roomId) {
					console.log('User reconnect failed, not in room');
					socket.emit('reconnect-error', {
						message: 'You are not in this room',
					});
					return;
				}
				if (activeUsers[_id] && activeUsers[_id].room === roomId) {
					socket.join(roomId);
					if (roomTimer) clearTimeout(roomTimer);
					activeUsers[_id].activeInRoom = true;
					console.log('User reconnected: ' + _id);
					io.to(roomId).emit(
						'player-reconnected',
						`${username} reconnected`
					);
				}
			});
		} else {
			activeUsers[_id] = {
				username,
				room: null,
				disconnected: false,
				isFirstConnection: true,
				activeInRoom: false,
			};
		}

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

			if (activeUsers[_id].room) {
				handleError(
					socket,
					new Error(
						`Already in a room, wait 30s or first leave the room ${activeUsers[_id].room}`
					)
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
			console.log('Recieved event room-join');
			if (!activeRooms[roomId]) {
				handleError(socket, new Error('Room does not exist'));
				return;
			}

			//check if user is already in any room
			if (activeUsers[_id].room !== null) {
				//if already in the room
				if (activeUsers[_id].room === roomId) {
					console.log('User rejoined the room');
					socket.join(roomId);
					if (roomTimer) clearTimeout(roomTimer);
					activeUsers[_id].activeInRoom = true;
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
			activeUsers[_id].activeInRoom = true;

			io.to(roomId).emit(
				'room-joined',
				`${username} joined the room ${roomId}`
			); // Emit room information to all users in the room
		});

		socket.on('make-move', ({ move, roomId }) => {
			console.log('Player move: ' + move);
			io.to(roomId).emit('player-move', move);
		});

		socket.on('resign', () => {
			console.log(`User ${_id} resigned`);
			const user = activeUsers[_id];
			if (
				activeUsers[_id] &&
				activeUsers[_id].room &&
				activeUsers[_id].activeInRoom
			) {
				removeUserFromRoom(
					_id,
					user,
					socket,
					io,
					activeUsers,
					activeRooms,
					activeConnections
				);
			}
		});

		socket.on('disconnect', () => {
			console.log('User lost connection: ' + _id);
			const user = activeUsers[_id];
			if (user) {
				if (user && user.activeInRoom) {
					user.activeInRoom = false;
					if (user.room) {
						io.to(user.room).emit(
							'player-reconnecting',
							`${user.username} reconnecting...`
						);
						console.log('Player reconnecting... ' + user.username);
					}
				}
				user.disconnected = true;

				// Set a timer to automatically remove the user if they don't reconnect within the specified timeframe
				roomTimer = setTimeout(() => {
					if (
						activeUsers[_id] &&
						activeUsers[_id].room &&
						!activeUsers[_id].activeInRoom
					) {
						removeUserFromRoom(
							_id,
							user,
							socket,
							io,
							activeUsers,
							activeRooms,
							activeConnections
						);
					}
				}, 10000); //10s

				// Set a timer to automatically remove the user form activeUsers and activeConnection.
				connectionTimer = setTimeout(() => {
					removeUserFromActiveConnections(_id, activeConnections);
				}, 10100); // 10.1 seconds timeout
			}
		});
	});

	return io;
};

export default startSocketServer;

function removeUserFromRoom(
	_id: string,
	user: User,
	socket: Socket,
	io: Server,
	activeUsers: ActiveUsers,
	activeRooms: ActiveRooms,
	activeConnections: ActiveConnections
) {
	console.log(_id, user, socket.connected);
	console.log(activeUsers);
	console.log(activeRooms);
	console.log(Object.keys(activeConnections));

	console.log('inside roomTimer');
	const roomId = activeUsers[_id].room;
	if (roomId) {
		activeRooms[roomId] = activeRooms[roomId].filter(
			(userId: string) => userId !== _id
		);

		socket.leave(roomId);
		activeUsers[_id].room = null;
		console.log(`User: ${_id} left room: ${user.room}`);
		console.log('User disconnected: ' + _id);

		io.to(roomId).emit(
			'player-disconnect',
			`You won by ${user.username}'s disconnection 🎉`
		);

		const oppositeUserId = activeRooms[roomId].find(
			(userId: string) => userId != _id
		);

		if (oppositeUserId) {
			const oppositeUserSocket = activeConnections[oppositeUserId];
			oppositeUserSocket.leave(roomId);
			activeUsers[oppositeUserId].room = null;
			console.log(`User: ${oppositeUserId} left room: ${user.room}`);
			console.log(`User disconnected: ${oppositeUserId}`);
		}

		delete activeRooms[roomId];
		console.log('Room deleted: ' + roomId + ':1');
	}
}

function removeUserFromActiveConnections(
	_id: string,
	activeConnections: ActiveConnections
) {
	if (activeUsers[_id] && activeUsers[_id].disconnected) {
		console.log('inside connectionTimer');
		if (activeConnections[_id]) {
			activeConnections[_id].disconnect(true);
			delete activeConnections[_id];
		}
		delete activeUsers[_id];
	}
}
