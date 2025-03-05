const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map();

wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "join") {
            clients.set(data.name, ws);
            ws.name = data.name;
        } else if (data.type === "signal") {
            const target = clients.get(data.to);
            if (target) {
                target.send(JSON.stringify({ type: "signal", from: ws.name, data: data.data }));
            }
        }
    });

    ws.on("close", () => {
        clients.delete(ws.name);
        console.log("Client disconnected");
    });
});

console.log("WebSocket signaling server running on ws://localhost:8080");
