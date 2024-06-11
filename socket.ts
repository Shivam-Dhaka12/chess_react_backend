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

interface Player {
	playerId: string;
	playerName: string;
	playerColor: string;
}
interface ActiveUsers {
	[userId: string]: User;
}

interface RoomState {
	board: string;
	moves: object[];
	players: Player[];
}

interface ActiveRooms {
	[roomId: string]: RoomState;
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

	const handleError = (socket: Socket, error: Error, navigateURL: string) => {
		console.log('Error: ' + error.message);
		io.to(socket.id).emit('error', { message: error.message, navigateURL });
	};
	//
	io.on('connection', (socket: Socket) => {
		// @ts-ignore
		const { username, _id } = socket?.decoded || {};
		console.log('A user connected: ' + _id);

		if (activeUsers[_id]) {
			if (connectionTimer) clearTimeout(connectionTimer);
			activeUsers[_id].disconnected = false;
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
					new Error('A room with this name already exists'),
					'/user/room'
				);
				return;
			}

			if (activeUsers[_id].room) {
				handleError(
					socket,
					new Error(
						`Already in a room, wait 30s or first leave the room ${activeUsers[_id].room}`
					),
					'/user/room'
				);
				return;
			}

			console.log('Room created: ' + roomId);
			activeRooms[roomId] = {
				board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
				moves: [],
				players: [],
			};
			socket.emit('room-created', roomId);
		});

		socket.on('room-join', (roomId: string) => {
			console.log('Recieved event room-join, user: ' + _id);
			if (!activeRooms[roomId]) {
				handleError(
					socket,
					new Error('Room does not exist'),
					'/user/room'
				);
				return;
			}

			//check if user is already in any room
			if (activeUsers[_id].room !== null) {
				//if already in the room
				if (activeUsers[_id].room === roomId) {
					console.log('User rejoined the room ' + _id);
					socket.join(roomId);
					if (roomTimer) clearTimeout(roomTimer);
					activeUsers[_id].activeInRoom = true;

					console.log('Sending Fen: ' + activeRooms[roomId].board);
					io.to(roomId).emit('room-joined', {
						msgFromServer: `${username} reconnected`,
						roomState: activeRooms[roomId],
					});
				} else {
					handleError(
						socket,
						new Error(
							`Already in a room, wait 30s or first leave the room ${activeUsers[_id].room}`
						),
						'/user/room'
					);
				}
				return;
			}

			if (activeRooms[roomId].players.length >= 2) {
				handleError(socket, new Error('Room is full'), '/user/room');
				return;
			}
			socket.join(roomId);

			let player: Player;

			if (activeRooms[roomId].players.length == 0) {
				player = {
					playerId: _id,
					playerColor: 'white',
					playerName: username,
				};
			} else {
				player = {
					playerId: _id,
					playerColor: 'black',
					playerName: username,
				};
			}
			activeRooms[roomId].players.push(player);
			//activeRooms[roomId].map((player: Player) => console.log(player));
			activeUsers[_id].room = roomId;
			activeUsers[_id].activeInRoom = true;

			io.to(roomId).emit('room-joined', {
				msgFromServer: `${username} joined the room ${roomId}`,
				roomState: activeRooms[roomId],
			}); // Emit room information to all users in the room
		});

		socket.on('make-move', ({ move, fen, roomId }) => {
			const { from, to, color } = move;
			console.log('Player move: ' + from + ' ' + to + ' ' + color);
			console.log('Fen: ' + fen);
			console.log('RoomId: ' + roomId);
			if (activeRooms[roomId]) {
				activeRooms[roomId].moves.push(move);
				activeRooms[roomId].board = fen;
				console.log('Room Board: ' + activeRooms[roomId].board);
			}
			socket.to(roomId).emit('player-move', { move, username });
		});

		// socket.on('reset-board', (fen: string, roomId: string) => {
		// 	if (activeRooms[roomId]) {
		// 		activeRooms[roomId].board = fen;
		// 	} else {
		// 		console.log('Room Does not exist');
		// 	}
		// });
		socket.on(
			'game-over',
			({ roomId, result }: { roomId: string; result: string }) => {
				if (activeRooms[roomId]) {
					console.log(`Game over: ${result}`);
				}
				socket.leave(roomId);
				delete activeRooms[roomId];
				removeUserFromActiveConnections(_id, activeConnections);
			}
		);

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
	socket: Socket,
	io: Server,
	activeUsers: ActiveUsers,
	activeRooms: ActiveRooms,
	activeConnections: ActiveConnections
) {
	const roomId = activeUsers[_id].room;
	const user = activeUsers[_id];
	if (roomId && activeRooms[roomId]) {
		activeRooms[roomId].players = activeRooms[roomId].players.filter(
			(player: Player) => player.playerId !== _id
		);

		socket.leave(roomId);
		activeUsers[_id].room = null;
		console.log(`User: ${_id} left room: ${user.room}`);
		console.log('User disconnected: ' + _id);

		io.to(roomId).emit(
			'player-disconnect',
			`You won by ${user.username}'s disconnection 🎉`
		);

		const oppositePlayer = activeRooms[roomId].players.find(
			(player: Player) => player.playerId != _id
		);

		const oppositeUserId = oppositePlayer?.playerId;

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
		if (activeConnections[_id]) {
			activeConnections[_id].disconnect(true);
			delete activeConnections[_id];
		}
		delete activeUsers[_id];
	}
}
