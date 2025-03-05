const express = require("express");
const { WebSocketServer } = require("ws");
const cors = require("cors"); // Make sure to install cors package with: npm install cors

const app = express();
const server = require("http").createServer(app);
const wss = new WebSocketServer({ server });

let broadcaster = null;
const clients = new Set();
// Add CORS middleware
app.use(cors({
    origin: '*', // Be more specific in production
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

wss.on("connection", (ws) => {
    console.log("New client connected");
    clients.add(ws);

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Received message type:", data.type);
            console.log("Full message:", JSON.stringify(data, null, 2));

            switch (data.type) {
                case "startShare":
                    broadcaster = ws;
                    console.log("A client started sharing their screen.");
                    break;

                case "signal":
                    // Broadcast signal to all other clients except the sender
                    console.log("Signal data:", data.data);
                    
                    // Broadcast to all clients except the sender
                    clients.forEach(client => {
                        if (client !== ws && client.readyState === ws.OPEN) {
                            try {
                                client.send(JSON.stringify({
                                    type: "signal",
                                    data: data.data
                                }));
                                console.log("Sent signal to a client");
                            } catch (sendError) {
                                console.error("Error sending signal:", sendError);
                            }
                        }
                    });
                    break;

                // New cases for collaborative drawing
                case "drawStart":
                case "draw":
                case "drawEnd":
                case "clearDrawing":
                    // Broadcast drawing events to all other clients
                    clients.forEach(client => {
                        if (client !== ws && client.readyState === ws.OPEN) {
                            try {
                                client.send(JSON.stringify({
                                    type: data.type,
                                    data: data.data
                                }));
                            } catch (sendError) {
                                console.error("Error broadcasting drawing event:", sendError);
                            }
                        }
                    });
                    break;

                case "stopShare":
                    if (ws === broadcaster) {
                        console.log("Broadcaster stopped sharing.");
                        broadcaster = null;
                        
                        // Notify all clients about share stopping
                        clients.forEach(client => {
                            if (client !== ws && client.readyState === ws.OPEN) {
                                client.send(JSON.stringify({
                                    type: "stopShare"
                                }));
                            }
                        });
                    }
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
        
        if (ws === broadcaster) {
            console.log("Broadcaster disconnected, stopping screen sharing.");
            broadcaster = null;
            
            // Notify remaining clients that sharing has stopped
            clients.forEach(client => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify({
                        type: "stopShare"
                    }));
                }
            });
        } else {
            console.log("A watcher disconnected.");
        }
    });

    ws.on("error", (err) => {
        console.error("WebSocket error:", err);
        clients.delete(ws);
    });
});

// Serve static files if needed
app.use(express.static('public'));

server.listen(3000, () => console.log("Server running on port 3000"));