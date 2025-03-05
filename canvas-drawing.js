// Canvas Drawing Functionality
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let isDrawingEnabled = true;

function getCoordinates(e, drawingCanvas) {
    let x, y;
    
    // Check if it's a touch event
    if (e.touches) {
        const rect = drawingCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
    } 
    // Mouse event
    else {
        const rect = drawingCanvas.getBoundingClientRect();
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    
    return { x, y };
}

function initializeDrawing(ws, drawingCanvas, drawingContext, colorPicker, brushSize, debugInfo) {
    // Drawing event handlers
    function startDrawing(e) {
        // Prevent default to stop scrolling/zooming during drawing
        e.preventDefault();
        
        if (!isDrawingEnabled) return;
        
        isDrawing = true;
        const { x, y } = getCoordinates(e, drawingCanvas);
        lastX = x;
        lastY = y;

        // Send draw start event to other clients
        ws.send(JSON.stringify({
            type: "drawStart",
            data: {
                x: x,
                y: y,
                color: colorPicker.value,
                brushSize: brushSize.value
            }
        }));

        // Begin drawing locally
        drawingContext.beginPath();
        drawingContext.moveTo(x, y);
        drawingContext.strokeStyle = colorPicker.value;
        drawingContext.lineWidth = brushSize.value;
        drawingContext.lineCap = 'round';
        drawingContext.stroke();
    }

    function draw(e) {
        // Prevent default to stop scrolling/zooming during drawing
        e.preventDefault();
        
        if (!isDrawing || !isDrawingEnabled) return;
        
        const { x, y } = getCoordinates(e, drawingCanvas);
        
        drawingContext.lineTo(x, y);
        drawingContext.strokeStyle = colorPicker.value;
        drawingContext.lineWidth = brushSize.value;
        drawingContext.lineCap = 'round';
        drawingContext.stroke();

        // Send drawing data to other clients
        ws.send(JSON.stringify({
            type: "draw",
            data: {
                fromX: lastX,
                fromY: lastY,
                toX: x,
                toY: y,
                color: colorPicker.value,
                brushSize: brushSize.value
            }
        }));

        lastX = x;
        lastY = y;
    }

    function stopDrawing(e) {
        // Prevent default to stop scrolling/zooming during drawing
        e.preventDefault();
        
        if (!isDrawing) return;

        isDrawing = false;
        drawingContext.closePath();

        // Send draw end event to other clients
        ws.send(JSON.stringify({
            type: "drawEnd"
        }));
    }

    // Add event listeners for drawing
    function setupDrawingListeners() {
        // Mouse event listeners
        drawingCanvas.addEventListener('mousedown', startDrawing);
        drawingCanvas.addEventListener('mousemove', draw);
        drawingCanvas.addEventListener('mouseup', stopDrawing);
        drawingCanvas.addEventListener('mouseout', stopDrawing);

        // Touch event listeners
        drawingCanvas.addEventListener('touchstart', startDrawing, { passive: false });
        drawingCanvas.addEventListener('touchmove', draw, { passive: false });
        drawingCanvas.addEventListener('touchend', stopDrawing, { passive: false });
        drawingCanvas.addEventListener('touchcancel', stopDrawing, { passive: false });
    }

    // Drawing controls setup
    function setupDrawingControls(clearButton, toggleButton) {
        // Clear drawing canvas
        clearButton.addEventListener('click', () => {
            drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            
            // Send clear drawing event to other clients
            ws.send(JSON.stringify({
                type: "clearDrawing"
            }));
        });

        // Toggle drawing on/off
        toggleButton.addEventListener('click', () => {
            isDrawingEnabled = !isDrawingEnabled;
            toggleButton.textContent = isDrawingEnabled ? 'Disable Drawing' : 'Enable Drawing';
            drawingCanvas.style.pointerEvents = isDrawingEnabled ? 'auto' : 'none';
        });
    }

    // Handle remote drawing events
    function handleRemoteDrawEvent(data) {
        switch (data.type) {
            case "drawStart":
                drawingContext.beginPath();
                drawingContext.moveTo(data.data.x, data.data.y);
                drawingContext.strokeStyle = data.data.color;
                drawingContext.lineWidth = data.data.brushSize;
                drawingContext.lineCap = 'round';
                drawingContext.stroke();
                break;

            case "draw":
                drawingContext.lineTo(data.data.toX, data.data.toY);
                drawingContext.strokeStyle = data.data.color;
                drawingContext.lineWidth = data.data.brushSize;
                drawingContext.lineCap = 'round';
                drawingContext.stroke();
                break;

            case "drawEnd":
                drawingContext.closePath();
                break;

            case "clearDrawing":
                drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
                break;
        }
    }

    // Resize canvas to full screen
    function resizeCanvas() {
        drawingCanvas.width = window.innerWidth;
        drawingCanvas.height = window.innerHeight;
        drawingCanvas.style.pointerEvents = 'none';
    }

    // Initialize everything
    function initialize(clearButton, toggleButton) {
        // Set up initial canvas size
        resizeCanvas();

        // Add resize listener
        window.addEventListener('resize', resizeCanvas);

        // Set up drawing listeners
        setupDrawingListeners();

        // Set up drawing controls
        setupDrawingControls(clearButton, toggleButton);

        // Return functions for external use
        return {
            handleDrawEvent: handleRemoteDrawEvent,
            resizeCanvas: resizeCanvas
        };
    }

    // Return initialization function
    return initialize;
}