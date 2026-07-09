const jwt = require('jsonwebtoken');
const userService = require('./services/users');
const { JWT_SECRET } = require('./utils/jwtSecret');
const { getRedisPubSub, isRedisAvailable } = require('./utils/redis');
const { isParticipant } = require('./utils/conversationHelpers');

async function initSocket(httpServer, allowedOrigins) {
  const { Server } = require('socket.io');

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        if (process.env.NODE_ENV !== 'production') return cb(null, true);
        return cb(new Error('Not allowed'));
      },
      credentials: true,
    },
  });

  if (isRedisAvailable()) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { pub, sub } = getRedisPubSub();
      if (pub && sub) {
        io.adapter(createAdapter(pub, sub));
        console.log('Socket.io Redis adapter enabled');
      }
    } catch (err) {
      console.warn('Socket.io Redis adapter failed:', err.message);
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('Redis unavailable — Socket.io will not scale across instances');
  } else {
    console.warn('Socket.io: single-server mode (start Redis for multi-instance chat)');
  }

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.type && payload.type !== 'access') {
        return next(new Error('Invalid token type'));
      }
      const user = await userService.getSocketUser(payload.userId);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`);

    socket.on('join_conversation', async (conversationId) => {
      try {
        const cid = String(conversationId || '').trim();
        if (!cid) return;
        // Without this check, any authenticated socket could join any
        // conversation room by guessing/enumerating ids and silently receive
        // chat_message/chat_typing events for a DM or group it isn't part of.
        const ok = await isParticipant(cid, socket.user._id);
        if (!ok) return;
        socket.join(`conversation:${cid}`);
      } catch (err) {
        console.warn('join_conversation failed:', err.message);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    socket.on('chat_typing', async (payload = {}) => {
      try {
        const conversationId = String(payload.conversationId || '').trim();
        if (!conversationId) return;
        const isTyping = Boolean(payload.isTyping);
        // Previously queried a non-existent `conversationParticipant` model
        // (the real model is ConversationMember) — every call threw and was
        // silently swallowed by the catch below, so typing indicators never
        // worked and this membership check never actually ran.
        const ok = await isParticipant(conversationId, socket.user._id);
        if (!ok) return;
        io.to(`conversation:${conversationId}`).emit('chat_typing', {
          conversationId,
          isTyping,
          user: {
            _id: socket.user._id,
            username: socket.user.username,
            displayName: socket.user.displayName || socket.user.username,
          },
        });
      } catch (err) {
        console.warn('chat_typing socket handler failed:', err.message);
      }
    });
  });

  return io;
}

function emitChatMessage(io, conversationId, message) {
  io.to(`conversation:${conversationId}`).emit('chat_message', message);
}

// Force a user's currently-connected sockets out of a conversation room —
// call this when removing/leaving a group so a removed member's already-open
// tab stops receiving new messages instead of relying on them to reconnect.
async function evictUserFromConversation(io, conversationId, userId) {
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  for (const s of sockets) {
    s.leave(`conversation:${conversationId}`);
  }
}

module.exports = { initSocket, emitChatMessage, evictUserFromConversation };
