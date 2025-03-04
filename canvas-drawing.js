const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const textContainer = document.getElementById("recognized-text-container");

let strokes = {};
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let lineWidth = 2;
let trace = [];
let lineIndex = 0;
let boundingBoxes = []; // Stores merged bounding boxes
let showBoundingBoxes = true; // State to track visibility of bounding boxes
let undoStack = []; // Stack to store strokes for undo functionality
let currentStrokePoints = []; // Temporary array to collect points during a stroke
let screenshotImage = null; // Store the screenshot image
let screenStream;
let screenSharing = false;


function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    // Store current canvas content
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(canvas, 0, 0);

    // Resize the actual canvas
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Restore previous content
    ctx.drawImage(tempCanvas, 0, 0);

    // Redraw strokes and bounding boxes
    redrawCanvas();
}


window.addEventListener("resize", resizeCanvas);
resizeCanvas();


function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;    // Adjust for X scaling
    const scaleY = canvas.height / rect.height;  // Adjust for Y scaling

    if (event.touches) {
        return {
            x: (event.touches[0].clientX - rect.left) * scaleX,
            y: (event.touches[0].clientY - rect.top) * scaleY
        };
    } else {
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }
}

// Handle touch start
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault(); // Prevent scrolling while drawing
    isDrawing = true;
    trace = [];
    const { x, y } = getCanvasCoords(e);
    lastX = x;
    lastY = y;

    if (!strokes[clientId]) {
        strokes[clientId] = [];
    }

    currentStrokePoints = [];
    trace.push({ x, y, t: Date.now() });
});

// Handle touch move
canvas.addEventListener("touchmove", (e) => {
    e.preventDefault(); // Prevent scrolling
    if (!isDrawing) return;

    const { x, y } = getCanvasCoords(e);
    const stroke = { x, y, prevX: lastX, prevY: lastY, lineWidth };

    draw(stroke.x, stroke.y, stroke.prevX, stroke.prevY, stroke.lineWidth);
    currentStrokePoints.push(stroke);

    let strokeId = strokes[clientId].length - 1;

    if (!Array.isArray(strokes[clientId][strokeId])) {
        strokes[clientId][strokeId] = [];
    }

    strokes[clientId][strokeId].push(stroke);
    trace.push({ x, y, t: Date.now() });

    sendDrawingData(stroke);

    lastX = x;
    lastY = y;
});

// Handle touch end
canvas.addEventListener("touchend", () => {
    isDrawing = false;
    if (trace.length > 0) {
        let newBox = getBoundingBox(trace);
        mergeBoundingBoxes(newBox);
    }

    if (strokes[clientId]) {
        strokes[clientId].push([...currentStrokePoints]);
    }

    sendToGoogle(trace, lineIndex);
    lineIndex++;
});
canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    trace = [];
    const { x, y } = getCanvasCoords(e);
    lastX = x;
    lastY = y;

    // Initialize the client's strokes array if it doesn't exist
    if (!strokes[clientId]) {
        strokes[clientId] = [];
    }
    
    // Start a new collection of points for this stroke
    currentStrokePoints = [];
    
    // Add the initial point
    trace.push({ x, y, t: Date.now() });
    
});


canvas.addEventListener("mouseup", () => {
    isDrawing = false;
    if (trace.length > 0) {
        let newBox = getBoundingBox(trace);
        mergeBoundingBoxes(newBox);
    }
    
    // Save the full stroke as a single entry in the strokes array
    if (strokes[clientId]) {
        strokes[clientId].push([...currentStrokePoints]); // Store full stroke
    }
    redrawCanvas();
    sendToGoogle(trace, lineIndex);
    lineIndex++;
});

canvas.addEventListener("mouseleave", () => isDrawing = false);

canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);

    const stroke = { x, y, prevX: lastX, prevY: lastY, lineWidth };
    draw(stroke.x, stroke.y, stroke.prevX, stroke.prevY, stroke.lineWidth);
    currentStrokePoints.push(stroke); // Store points in the current stroke

    let strokeId = strokes[clientId].length - 1;

    if (!Array.isArray(strokes[clientId][strokeId])) {
        strokes[clientId][strokeId] = [];
    }

    strokes[clientId][strokeId].push(stroke);
    trace.push({ x, y, t: Date.now() });

    sendDrawingData(stroke);
    
    console.log(`Line drawn from (${lastX}, ${lastY}) to (${x}, ${y})`);

    lastX = x;
    lastY = y;

});

function sendDrawingData(stroke) {
    ws.send(JSON.stringify({ type: "draw", stroke, clientId }));
}

function draw(x, y, prevX, prevY, width) {
    ctx.lineWidth = width;
    ctx.strokeStyle = "black";
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
}

// Function to calculate bounding box of a stroke
function getBoundingBox(trace) {
    let minX = trace[0].x;
    let minY = trace[0].y;
    let maxX = trace[0].x;
    let maxY = trace[0].y;

    trace.forEach(point => {
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
    });

    return { x: minX - 2, y: minY - 2, width: maxX - minX + 4, height: maxY - minY + 4 };
}

// Function to check if two bounding boxes overlap
function isOverlapping(box1, box2) {
    return !(
        box1.x + box1.width < box2.x || // Box1 is left of Box2
        box2.x + box2.width < box1.x || // Box2 is left of Box1
        box1.y + box1.height < box2.y || // Box1 is above Box2
        box2.y + box2.height < box1.y // Box2 is above Box1
    );
}

// Function to merge overlapping bounding boxes
function mergeBoundingBoxes(newBox) {
    let merged = false;

    for (let i = 0; i < boundingBoxes.length; i++) {
        if (isOverlapping(boundingBoxes[i], newBox)) {
            boundingBoxes[i] = {
                x: Math.min(boundingBoxes[i].x, newBox.x),
                y: Math.min(boundingBoxes[i].y, newBox.y),
                width: Math.max(boundingBoxes[i].x + boundingBoxes[i].width, newBox.x + newBox.width) - Math.min(boundingBoxes[i].x, newBox.x),
                height: Math.max(boundingBoxes[i].y + boundingBoxes[i].height, newBox.y + newBox.height) - Math.min(boundingBoxes[i].y, newBox.y)
            };
            merged = true;
            break;
        }
    }

    if (!merged) {
        boundingBoxes.push(newBox);
    }

    redrawCanvas();
}
document.getElementById("toggleBoundingBoxBtn").addEventListener("click", () => {
    showBoundingBoxes = !showBoundingBoxes;
    redrawCanvas();
});

function redrawCanvas() {
    // ✅ Do NOT clear the canvas (this prevents overwriting the screen share)

    // ✅ Redraw strokes on top of the screen share
    for (const client in strokes) {
        if (!Array.isArray(strokes[client])) continue;

        strokes[client].forEach((strokeList) => {
            if (!Array.isArray(strokeList)) return;

            strokeList.forEach((stroke) => {
                draw(stroke.x, stroke.y, stroke.prevX, stroke.prevY, stroke.lineWidth);
            });
        });
    }

    // ✅ Draw bounding boxes on top
    if (showBoundingBoxes) {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 1;
        boundingBoxes.forEach(box => {
            ctx.strokeRect(box.x, box.y, box.width, box.height);
        });
    }
}




function showRecognizedText(text, x, y) {
    const textDiv = document.createElement("div");
    textDiv.className = "recognized-text";
    textDiv.innerText = text;
    textDiv.style.left = `${x}px`;
    textDiv.style.top = `${y}px`;
    document.getElementById("recognized-text-container").appendChild(textDiv);

    setTimeout(() => {
        textDiv.remove();
    }, 5000);
}
// Event listener for undo button
document.getElementById("undoBtn").addEventListener("click", undoLastStroke);

// Event listener for Cmd + Z (Mac) and Ctrl + Z (Windows)
document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault(); // Prevent default browser behavior
        undoLastStroke();
    }
});

function undoLastStroke() {
    if (strokes[clientId] && strokes[clientId].length > 0) {
        // Remove the last full stroke (all points from mousedown to mouseup)
        const removedStroke = strokes[clientId].pop();
        undoStack.push(removedStroke);

        // Recalculate bounding boxes after stroke removal
        recalculateBoundingBoxes();

        // Update lineIndex
        if (lineIndex > 0) {
            lineIndex--;
        }

        // Redraw everything
        redrawCanvas();

        console.log("Removed full stroke with", removedStroke ? removedStroke.length : 0, "points");
    }
}

// Function to recalculate all bounding boxes from current strokes
function recalculateBoundingBoxes() {
    boundingBoxes = [];
    
    // Rebuild all bounding boxes from existing strokes
    for (const client in strokes) {
        if (!Array.isArray(strokes[client])) continue;
        
        strokes[client].forEach(strokeList => {
            if (!Array.isArray(strokeList) || strokeList.length === 0) return;
            
            // Create a trace from the stroke points for bounding box calculation
            const strokeTrace = strokeList.map(stroke => ({
                x: stroke.x,
                y: stroke.y,
                t: Date.now() // Time isn't critical for recalculation
            }));
            
            if (strokeTrace.length > 0) {
                const newBox = getBoundingBox(strokeTrace);
                mergeBoundingBoxes(newBox);
            }
        });
    }
}
async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30, width: 1920, height: 1080 }
        });

        const video = document.createElement("video");
        video.srcObject = screenStream;
        video.play();
        screenSharing = true;

        function captureFrame() {
            if (!screenSharing) return;

            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext("2d");

            // ✅ Draw the screen share **before** strokes
            tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

            // ✅ Immediately redraw strokes on top
            redrawCanvas();

            // ✅ Send video frame to remote clients
            const imgData = tempCanvas.toDataURL("image/jpeg", 0.8);
            ws.send(JSON.stringify({ type: "screenShare", image: imgData }));

            requestAnimationFrame(captureFrame);
        }

        requestAnimationFrame(captureFrame);
    } catch (error) {
        console.error("Error starting screen share:", error);
    }
}



function drawLiveScreen(imgData) {
    const img = new Image();
    img.onload = () => {
        // ✅ Draw screen share (background)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // ✅ Immediately redraw all strokes on top
        redrawCanvas();
    };
    img.src = imgData;
}




function drawScreenshot(imgData) {
    screenshotImage = new Image();
    screenshotImage.onload = () => {
        // ✅ Store the screenshot in memory
        screenshotImage = screenshotImage; 
        redrawCanvas(); // ✅ Ensures strokes are drawn on top of the screenshot
    };
    screenshotImage.src = imgData;
}
function stopScreenShare() {
    if (!screenStream) return;
    
    screenSharing = false;
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;

    console.log("Screen sharing stopped");
}
document.getElementById("screenshotBtn").addEventListener("click", () => {
    if (screenSharing) {
        stopScreenShare();
        document.getElementById("screenshotBtn").innerText = "Start Screen Share";
    } else {
        startScreenShare();
        document.getElementById("screenshotBtn").innerText = "Stop Screen Share";
    }
});
// 📸 **Capture a screenshot**
async function captureScreenshot() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                width: 1920, // Request Full HD
                height: 1080, 
                frameRate: 30 // Higher frame rate for better quality
            } 
        });

        const video = document.createElement("video");
        video.srcObject = stream;
        video.play();

        video.onloadedmetadata = async () => {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = video.videoWidth;
            tempCanvas.height = video.videoHeight;
            const tempCtx = tempCanvas.getContext("2d");

            // Capture the screenshot with better quality
            tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
            const imgData = tempCanvas.toDataURL("image/png"); // PNG for higher quality

            // ✅ Immediately display the high-quality screenshot
            drawScreenshot(imgData);

            // ✅ Send high-quality image via WebSocket
            ws.send(JSON.stringify({ type: "screenshot", image: imgData }));

            // Stop video stream after capture
            stream.getTracks().forEach(track => track.stop());
        };
    } catch (error) {
        console.error("Error capturing screenshot:", error);
    }
}

