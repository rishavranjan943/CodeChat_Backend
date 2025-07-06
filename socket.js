require("dotenv").config();

let io;

function initSocket(server) {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL, // e.g., "http://localhost:3000"
      methods: ["GET", "POST", "DELETE"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, user }) => {
      socket.join(roomId);
      socket.data.user = user;

      const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const users = socketsInRoom
        .map((id) => io.sockets.sockets.get(id)?.data?.user)
        .filter(Boolean);

      io.to(roomId).emit("room-members", users);
      console.log(`Room ${roomId} members:`, users);
    });

    socket.on("leave-room", (roomId) => {
        socket.leave(roomId);
      
        const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        const users = socketsInRoom
          .map((id) => io.sockets.sockets.get(id)?.data?.user)
          .filter(Boolean);
      
        io.to(roomId).emit("room-members", users);
        console.log(`User ${socket.id} left room ${roomId}`);
      });

      socket.on("code-change", ({ roomId, code }) => {
        socket.to(roomId).emit("code-change", code);
      });
      
      socket.on("language-change", ({ roomId, language }) => {
        socket.to(roomId).emit("language-change", language);
      });
      
      socket.on("run-code", async ({ roomId, code, language }) => {
        try {
          const response = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              language,
              version: "*",
              files: [{ name: "main", content: code }],
            }),
          });
      
          const data = await response.json();
          const rawOutput = data?.run?.output || "No output";
      
          io.to(roomId).emit("code-output", { output: rawOutput });
        } catch (err) {
          io.to(roomId).emit("code-output", { output: "Execution failed." });
        }
      });
      
      

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
          const updatedUsers = socketsInRoom
            .filter((id) => id !== socket.id)
            .map((id) => io.sockets.sockets.get(id)?.data?.user)
            .filter(Boolean);

          socket.to(roomId).emit("room-members", updatedUsers);
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
