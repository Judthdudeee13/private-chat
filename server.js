const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = new Map();

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function cleanName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

app.post("/api/create", (req, res) => {
  const creator = cleanName(req.body.creator);
  const names = Array.isArray(req.body.names)
    ? req.body.names.map(cleanName).filter(Boolean)
    : [];

  if (!creator || creator.length > 24 || names.length > 50 ||
      names.some(n => n.length > 24)) {
    return res.status(400).json({ error: "Check your names. Maximum 24 characters each and 50 names." });
  }

  const allowed = [...new Set(
    [creator, ...names].map(n => n.toLowerCase())
  )];

  let code;
  do {
    code = makeCode();
  } while (rooms.has(code));

  const secret = crypto.randomBytes(24).toString("hex");

  rooms.set(code, {
    creator: creator,
    secret,
    allowed,
    messages: [],
    members: new Map()
  });

  res.json({ code, secret });
});

app.post("/api/add-name", (req, res) => {
  const code = String(req.body.code || "").toUpperCase();
  const secret = String(req.body.secret || "");
  const name = cleanName(req.body.name);
  const room = rooms.get(code);

  if (!room || !secret || secret !== room.secret) {
    return res.status(403).json({ error: "Invalid creator access." });
  }

  if (!name || name.length > 24) {
    return res.status(400).json({ error: "Name must be 1–24 characters." });
  }

  if (room.allowed.includes(name.toLowerCase())) {
    return res.status(409).json({ error: "That name is already allowed." });
  }

  if (room.allowed.length >= 50) {
    return res.status(400).json({ error: "Name limit reached." });
  }

  room.allowed.push(name.toLowerCase());
  res.json({ success: true });
});

io.on("connection", socket => {
  socket.on("join-room", ({ code, name } = {}) => {
    code = String(code || "").trim().toUpperCase();
    name = cleanName(name);

    const room = rooms.get(code);

    if (!room || !name || name.length > 24 ||
        !room.allowed.includes(name.toLowerCase())) {
      socket.emit("join-error", "Room not found or your name is not approved.");
      return;
    }

    // Prevent the same name joining twice in one room.
    if (room.members.has(name.toLowerCase())) {
      socket.emit("join-error", "That name is already in the room.");
      return;
    }

    room.members.set(name.toLowerCase(), socket.id);
    socket.data.roomCode = code;
    socket.data.name = name;
    socket.join(code);

    socket.emit("joined", {
      code,
      name,
      messages: room.messages
    });

    io.to(code).emit("members", [...room.members.keys()]);
    socket.to(code).emit("system-message", `${name} joined the room.`);
  });

  socket.on("send-message", ({ text, replyTo } = {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    text = String(text || "").trim();

    if (!text || text.length > 2000) return;

    let reply = null;
    if (replyTo) {
      reply = room.messages.find(m => m.id === replyTo);
      if (!reply) return;
      reply = { id: reply.id, name: reply.name, text: reply.text };
    }

    const message = {
      id: crypto.randomUUID(),
      name: socket.data.name,
      text,
      reply,
      time: Date.now()
    };

    room.messages.push(message);
    if (room.messages.length > 200) room.messages.shift();

    io.to(code).emit("new-message", message);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const name = socket.data.name;
    const room = rooms.get(code);

    if (room && name) {
      room.members.delete(name.toLowerCase());
      io.to(code).emit("members", [...room.members.keys()]);
      socket.to(code).emit("system-message", `${name} left the room.`);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Private Chat running on port ${PORT}`);
});
