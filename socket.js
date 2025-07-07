require("dotenv").config();
let io;

function initSocket(server) {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST", "DELETE"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // ========= Collaboration: Room Join/Leave =========
    socket.on("join-room", ({ roomId, user }) => {
      socket.join(roomId);
      socket.data.user = user;

      const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const users = socketsInRoom
        .map((id) => io.sockets.sockets.get(id)?.data?.user)
        .filter(Boolean);

      io.to(roomId).emit("room-members", users);
    });

    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);

      const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const users = socketsInRoom
        .map((id) => io.sockets.sockets.get(id)?.data?.user)
        .filter(Boolean);

      io.to(roomId).emit("room-members", users);
    });

    // ========= Code Collaboration =========
    socket.on("code-change", ({ roomId, code }) => {
      socket.to(roomId).emit("code-change", code);
    });

    socket.on("language-change", ({ roomId, language }) => {
      socket.to(roomId).emit("language-change", language);
    });

    socket.on("run-code", async ({ roomId, code, language }) => {
      try {
        console.log(code)
        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            version: "*",
            files: [{ name: "main", content: code }],
          }),
        });

        console.log(data)

        const data = await response.json();
        const output = data?.run?.output || "No output";
        console.log(output)
        io.to(roomId).emit("code-output", { output });
      } catch (err) {
        io.to(roomId).emit("code-output", { output: "Execution failed." });
      }
    });

    // ========= Chat =========
    socket.on("chat-message", ({ roomId, user, message }) => {
      io.to(roomId).emit("chat-message", { user, message });
    });

    // ========= WebRTC Video/Audio Signaling =========
    socket.on("join-video-room", ({ roomId, user }) => {
      socket.join(roomId);
      socket.data.user = user;
    
      const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const otherUsers = socketsInRoom.filter((id) => id !== socket.id);
    
      // Notify others of new participant
      otherUsers.forEach((id) => {
        socket.to(id).emit("new-participant", { from: socket.id, user });
      });
    
      // Step 1: Get current media states in room
      const mediaStates = socketsInRoom
        .map((id) => {
          const sock = io.sockets.sockets.get(id);
          if (sock) {
            return {
              socketId: id,
              isVideoOn: sock.data.isVideoOn ?? true,
              isAudioOn: sock.data.isAudioOn ?? true,
            };
          }
          return null;
        })
        .filter(Boolean);
    
      // Step 2: Send media-sync to newly joined user
      io.to(socket.id).emit("media-sync", mediaStates);
    });
    
    

    socket.on("offer", ({ to, sdp }) => {
      const user = socket.data.user;
      io.to(to).emit("offer", { from: socket.id, sdp, user });
    });

    socket.on("answer", ({ to, sdp }) => {
      io.to(to).emit("answer", { from: socket.id, sdp });
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

    // ========= Media Sync (Video/Audio Toggle) =========
    socket.on("media-toggle", ({ roomId, userId, email, isVideoOn, isAudioOn }) => {
      socket.data.mediaState = { isVideoOn, isAudioOn }; // Store media state
    
      socket.to(roomId).emit("media-updated", {
        socketId: socket.id,
        userId,
        email,
        isVideoOn,
        isAudioOn,
      });
    });
    
    socket.on("media-sync", (mediaStates) => {
      mediaStates.forEach(({ socketId, isVideoOn, isAudioOn }) => {
        setPeers((prev) => {
          const updated = { ...prev };
          if (updated[socketId]) {
            updated[socketId].isVideoOn = isVideoOn;
            updated[socketId].isAudioOn = isAudioOn;
          }
          return updated;
        });
      });
    });
    

    socket.on("media-state-changed", ({ roomId, socketId, isVideoOn, isAudioOn }) => {
      socket.data.isVideoOn = isVideoOn;
      socket.data.isAudioOn = isAudioOn;
    
      socket.to(roomId).emit("media-state-changed", {
        socketId,
        isVideoOn,
        isAudioOn,
      });
    });
    

    socket.on("video-toggle", ({ roomId, userId, enabled }) => {
      socket.to(roomId).emit("video-toggle", { userId, enabled });
    });

    socket.on("audio-toggle", ({ roomId, userId, enabled }) => {
      socket.to(roomId).emit("audio-toggle", { userId, enabled });
    });

    // ========= Disconnect Cleanup =========
    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          const remainingUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
            .filter((id) => id !== socket.id)
            .map((id) => io.sockets.sockets.get(id)?.data?.user)
            .filter(Boolean);

          socket.to(roomId).emit("room-members", remainingUsers);
          socket.to(roomId).emit("user-left", socket.id);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

module.exports = { initSocket, getIO };
