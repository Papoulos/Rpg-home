const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const users = {};

io.on('connection', socket => {
    //generate a random id for the user and add it to the list of users
    if (!users[socket.id]) {
        users[socket.id] = socket.id;
    }
    //send the id to the user
    socket.emit("yourID", socket.id);
    //send all the users to the new user
    io.sockets.emit("allUsers", Object.keys(users));
    socket.on('disconnect', () => {
        //remove user from the list of users
        delete users[socket.id];
    })

    //a user is trying to call another user
    socket.on("callUser", (data) => {
        //send the signal to the other user
        io.to(data.userToCall).emit('hey', {signal: data.signalData, from: data.from});
    })

    //a user accepts a call
    socket.on("acceptCall", (data) => {
        //send the signal to the other user
        io.to(data.to).emit('callAccepted', data.signal);
    })
});

app.get('/api/hello', (req, res) => {
  res.send({ express: 'Hello From Express' });
});

server.listen(5000, () => console.log('server is running on port 5000'));
