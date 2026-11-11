const socket = io();

const $ = id => document.getElementById(id);

let currentCode = "";
let currentName = "";
let creatorSecret = "";
let replyTarget = null;

function notice(message) {
  const box = $("notice");
  box.textContent = message;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3500);
}

function showRoom(code, name, isCreator = false) {
  currentCode = code;
  currentName = name;

  $("home").classList.add("hidden");
  $("room").classList.remove("hidden");
  $("displayCode").textContent = code;
  $("myName").textContent = name;
  $("adminPanel").classList.toggle("hidden", !isCreator);
  $("messages").innerHTML = "";

  $("chatTitle").textContent = "Private conversation";
}

async function post(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Something went wrong.");
  }

  return result;
}

// Create a room
$("createForm").addEventListener("submit", async event => {
  event.preventDefault();

  const creator = $("creatorName").value.trim();
  const names = $("allowedNames").value
    .split("\n")
    .map(n => n.trim())
    .filter(Boolean);

  try {
    const result = await post("/api/create", {
      creator,
      names
    });

    creatorSecret = result.secret;

    showRoom(result.code, creator, true);
    socket.emit("join-room", {
      code: result.code,
      name: creator
    });

    notice("Room created! Your room code is " + result.code);
  } catch (error) {
    notice(error.message);
  }
});

// Join a room
$("joinForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("joinName").value.trim();
  const code = $("roomCode").value.trim().toUpperCase();

  if (!name || !code) return;

  currentCode = code;
  currentName = name;

  socket.emit("join-room", { code, name });
});

// Server confirms successful join
socket.on("joined", data => {
  showRoom(data.code, data.name, Boolean(creatorSecret));

  data.messages.forEach(addMessage);
  $("messages").scrollTop = $("messages").scrollHeight;
});

socket.on("join-error", message => {
  notice(message);
  currentCode = "";
  currentName = "";
});

// Add a message safely
function addMessage(message) {
  const welcome = $("messages").querySelector(".welcome-message");
  if (welcome) welcome.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "message" +
    (message.name === currentName ? " mine" : "");

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const time = new Date(message.time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  meta.textContent = message.name + " · " + time;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (message.reply) {
    const quote = document.createElement("div");
    quote.className = "reply-quote";
    quote.textContent = "Reply to " + message.reply.name +
      ": " + message.reply.text;
    bubble.appendChild(quote);
  }

  const content = document.createElement("div");
  content.textContent = message.text;
  bubble.appendChild(content);

  const reply = document.createElement("button");
  reply.className = "reply-btn";
  reply.textContent = "↩ Reply";
  reply.addEventListener("click", () => {
    replyTarget = message.id;
    $("replyText").textContent =
      "Replying to " + message.name + ": " + message.text;
    $("replyPreview").classList.remove("hidden");
    $("messageInput").focus();
  });

  wrapper.append(meta, bubble, reply);
  $("messages").appendChild(wrapper);
  $("messages").scrollTop = $("messages").scrollHeight;
}

socket.on("new-message", addMessage);

socket.on("system-message", message => {
  const item = document.createElement("div");
  item.className = "message-meta";
  item.style.textAlign = "center";
  item.style.margin = "15px";
  item.textContent = message;
  $("messages").appendChild(item);
});

socket.on("members", members => {
  $("memberList").innerHTML = "";

  members.forEach(name => {
    const item = document.createElement("div");
    item.className = "member";

    const dot = document.createElement("span");
    dot.className = "member-dot";

    item.append(dot, document.createTextNode(name));
    $("memberList").appendChild(item);
  });
});

// Send messages
$("messageForm").addEventListener("submit", event => {
  event.preventDefault();

  const text = $("messageInput").value.trim();
  if (!text) return;

  socket.emit("send-message", {
    text,
    replyTo: replyTarget
  });

  $("messageInput").value = "";
  replyTarget = null;
  $("replyPreview").classList.add("hidden");
});

$("cancelReply").addEventListener("click", () => {
  replyTarget = null;
  $("replyPreview").classList.add("hidden");
});

// Creator can approve more names
$("addNameForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("newAllowedName").value.trim();
  if (!name) return;

  try {
    await post("/api/add-name", {
      code: currentCode,
      secret: creatorSecret,
      name
    });

    $("newAllowedName").value = "";
    notice(name + " is now approved to join!");
  } catch (error) {
    notice(error.message);
  }
});

// Copy room code
$("copyCode").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentCode);
    notice("Room code copied!");
  } catch {
    notice("Copy unavailable. Your code is " + currentCode);
  }
});

// Leave room
$("leaveBtn").addEventListener("click", () => {
  socket.disconnect();
  location.reload();
});
