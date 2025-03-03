const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const server = require("http").createServer(app);
const wss = new WebSocketServer({ server });

let clients = new Set(); // Use a Set to prevent duplicate clients

wss.on("connection", (ws) => {
    console.log("New client connected");
    clients.add(ws);

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case "draw":
                    console.log(`Received stroke from Client ${data.clientId}`);
                    broadcast(data, ws);
                    break;
                
                case "screenshot":
                    console.log("Received screenshot from client");
                    broadcast(data, ws);
                    break;
                
                case "recognizedText":
                    console.log(`Received recognized text: "${data.text}" from Client ${data.clientId}`);
                    broadcast(data, ws);
                    break;
                
                default:
                    console.warn("Unknown message type received:", data.type);
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        console.log("Client disconnected");
    });
    
    ws.on("error", (err) => {
        console.error("WebSocket error:", err);
    });
});

// Broadcast function to send data to all connected clients
function broadcast(data, sender) {
    clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

server.listen(3000, () => console.log("Server running on port 3000"));