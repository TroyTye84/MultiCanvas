const ws = new WebSocket("wss://multicanvas.onrender.com/");

const clientId = Math.random().toString(36).substr(2, 9);
console.log(`Client ID: ${clientId}`);

strokes[clientId] = [];

ws.onmessage = (message) => {
    const data = JSON.parse(message.data);

    if (data.type === "screenShare") {  // ✅ Ensure it's "screenShare"
        console.log("Received screen share frame");
        drawLiveScreen(data.image);     // ✅ Broadcast to all clients
    } 
    else if (data.type === "draw") {
        console.log(`Received stroke from Client ${data.clientId}`);

        if (!strokes[data.clientId]) {
            strokes[data.clientId] = [];
        }

        strokes[data.clientId].push(data.stroke);
        draw(data.stroke.x, data.stroke.y, data.stroke.prevX, data.stroke.prevY, data.stroke.lineWidth);
    } 
    else if (data.type === "recognizedText") {
        console.log(`Received recognized text from Client ${data.clientId}: ${data.text}`);
        showRecognizedText(data.text, data.x, data.y);
    }
};



function showRecognizedText(text, x, y) {
    console.log(`Placing text: "${text}" at (${x}, ${y})`);

    // Ensure container exists
    const container = document.getElementById("recognized-text-container");
    if (!container) {
        console.error("recognized-text-container not found in the DOM.");
        return;
    }

    // Create a new div for the text
    const textDiv = document.createElement("div");
    textDiv.className = "recognized-text";
    textDiv.innerText = text;

    // Ensure it is within viewport bounds
    textDiv.style.position = "absolute";
    textDiv.style.left = `${Math.max(0, x)}px`;
    textDiv.style.top = `${Math.max(0, y)}px`;
    textDiv.style.zIndex = "1000"; // Make sure it appears above other elements

    container.appendChild(textDiv);

    // Debug log for visibility
    console.log(`Added text "${text}" at (${x}, ${y})`);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        textDiv.remove();
        console.log(`Removed text: "${text}"`);
    }, 5000);
}

function sendDrawingData(stroke) {
    ws.send(JSON.stringify({ type: "draw", stroke, clientId }));
}

function sendToGoogle(trace, lineIndex) {
    if (!trace || trace.length === 0) return;

    const inkArray = [[], [], []];
    trace.forEach(stroke => {
        inkArray[0].push(stroke.x);
        inkArray[1].push(stroke.y);
        inkArray[2].push(stroke.t);
    });

    const data = JSON.stringify({
        "requests": [{
            "writing_guide": {
                "writing_area_width": canvas.width,
                "writing_area_height": canvas.height
            },
            "ink": [inkArray],
            "language": "en"
        }]
    });

    fetch("https://www.google.com/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data
    })
    .then(response => response.json())
    .then(result => {
        if (result[0] === "SUCCESS") {
            let recognizedWords = result[1][0][1];
            if (recognizedWords && recognizedWords.length > 0) {
                let bestWord = recognizedWords[0];
                const ignoreChars = [".", "-", ",", "..", "\\"];
                if (ignoreChars.includes(bestWord)) return;

                console.log(`Recognized Word: ${bestWord}`);

                let avgX = trace.reduce((sum, point) => sum + point.x, 0) / trace.length;
                let avgY = trace.reduce((sum, point) => sum + point.y, 0) / trace.length - 15;

                // ✅ Immediately render text for the sender
                showRecognizedText(bestWord, avgX, avgY);

                // ✅ Send to WebSocket to broadcast to all clients
                ws.send(JSON.stringify({ 
                    type: "recognizedText", 
                    text: bestWord, 
                    x: avgX, 
                    y: avgY, 
                    clientId 
                }));
            }
        }
    })
    .catch(error => console.error("Error:", error));
}


