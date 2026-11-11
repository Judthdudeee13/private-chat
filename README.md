# Whisper - Private Chat Rooms

A private, code-based messaging website.

## Features

- Create private chat rooms.
- Automatically generate a six-character room code.
- Approve specific usernames.
- Add approved users after creating a room.
- Live messaging with Socket.IO.
- Reply to individual messages.
- See who is currently online.
- Responsive desktop and mobile design.

## Installation

1. Install Node.js.
2. Download or clone this repository.
3. Open a terminal inside the project folder.
4. Run:

   npm install

5. Start the website:

   npm start

6. Open:

   http://localhost:3000

## GitHub

Upload the entire private-chat folder to a GitHub repository.

## Deployment

GitHub stores your source code, but GitHub Pages
does not run the Node.js server.

Deploy this project using a Node.js hosting service
such as Render or Railway.

Use this start command:

npm start

## Important

This starter version stores rooms and messages in
server memory. Restarting the server deletes them.

For production, add persistent database storage,
HTTPS, rate limiting, and stronger authentication.

Creator access secrets should be kept private.
