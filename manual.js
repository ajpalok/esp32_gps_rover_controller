// Configuration
let config = {
    roverIP: window.location.hostname || '192.168.4.1',
    updateInterval: 500,
    currentSpeed: 150
};

// Load config from localStorage
if (localStorage.getItem('roverConfig')) {
    const savedConfig = JSON.parse(localStorage.getItem('roverConfig'));
    config.roverIP = savedConfig.roverIP || config.roverIP;
    config.updateInterval = savedConfig.updateInterval || config.updateInterval;
}

// State
let isConnected = false;
let isPressed = false;

// Send manual control command
function sendControlCommand(command, speed = null) {
    const controlSpeed = speed || config.currentSpeed;
    
    fetch(`http://${config.roverIP}/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `command=${command}&speed=${controlSpeed}`
    })
    .then(response => response.json())
    .then(data => {
        addLogMessage(`Command: ${command} (speed: ${controlSpeed})`);
    })
    .catch(error => {
        console.error('Control command error:', error);
        addLogMessage(`Error: ${error.message}`);
    });
}

// Update rover status
function updateStatus() {
    fetch(`http://${config.roverIP}/api/status`)
        .then(response => response.json())
        .then(data => {
            isConnected = true;
            updateConnectionStatus();

            // Update status display
            document.getElementById('position').textContent = 
                `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`;
            document.getElementById('heading').textContent = data.heading.toFixed(1) + '°';
            document.getElementById('speed').textContent = data.speed.toFixed(2) + ' km/h';
            document.getElementById('gpsStatus').textContent = 
                data.gpsValid ? `✓ ${data.satellites} sats` : '✗ No fix';
        })
        .catch(error => {
            isConnected = false;
            updateConnectionStatus();
            console.error('Status update error:', error);
        });
}

// Update connection status indicator
function updateConnectionStatus() {
    const indicator = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');

    if (isConnected) {
        indicator.classList.add('connected');
        indicator.classList.remove('disconnected');
        text.textContent = 'Connected';
    } else {
        indicator.classList.add('disconnected');
        indicator.classList.remove('connected');
        text.textContent = 'Disconnected';
    }
}

// Add log message
function addLogMessage(message) {
    const logContainer = document.getElementById('activityLog');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    if (logContainer.children.length > 30) {
        logContainer.removeChild(logContainer.firstChild);
    }
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Button event handlers
function setupButtonEvents() {
    const buttons = {
        'forwardBtn': 'forward',
        'backwardBtn': 'backward',
        'leftBtn': 'left',
        'rightBtn': 'right',
        'stopBtn': 'stop'
    };

    Object.keys(buttons).forEach(btnId => {
        const btn = document.getElementById(btnId);
        const command = buttons[btnId];
        
        // Mouse/touch events
        btn.addEventListener('mousedown', () => {
            isPressed = true;
            sendControlCommand(command);
            btn.classList.add('active');
        });
        
        btn.addEventListener('mouseup', () => {
            isPressed = false;
            if (command !== 'stop') {
                sendControlCommand('stop');
            }
            btn.classList.remove('active');
        });
        
        btn.addEventListener('mouseleave', () => {
            if (isPressed) {
                isPressed = false;
                sendControlCommand('stop');
                btn.classList.remove('active');
            }
        });
        
        // Touch events for mobile
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isPressed = true;
            sendControlCommand(command);
            btn.classList.add('active');
        });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            isPressed = false;
            if (command !== 'stop') {
                sendControlCommand('stop');
            }
            btn.classList.remove('active');
        });
    });
}

// Speed slider
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

speedSlider.addEventListener('input', function() {
    config.currentSpeed = parseInt(this.value);
    speedValue.textContent = config.currentSpeed;
});

// Keyboard controls
let activeKey = null;

document.addEventListener('keydown', function(e) {
    // Prevent repeat if key is already pressed
    if (activeKey === e.key) return;
    
    let command = null;
    
    switch(e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
            command = 'forward';
            e.preventDefault(); // Prevent page scroll
            break;
        case 'arrowdown':
        case 's':
            command = 'backward';
            e.preventDefault(); // Prevent page scroll
            break;
        case 'arrowleft':
        case 'a':
            command = 'left';
            e.preventDefault(); // Prevent page scroll
            break;
        case 'arrowright':
        case 'd':
            command = 'right';
            e.preventDefault(); // Prevent page scroll
            break;
        case ' ':
            command = 'stop';
            e.preventDefault(); // Prevent page scroll
            break;
    }
    
    if (command) {
        activeKey = e.key;
        sendControlCommand(command);
        highlightButton(command, true);
    }
});

document.addEventListener('keyup', function(e) {
    activeKey = null;
    
    const keys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
    
    if (keys.includes(e.key.toLowerCase())) {
        e.preventDefault(); // Prevent page scroll
        sendControlCommand('stop');
        highlightAllButtons(false);
    }
});

// Visual feedback for keyboard
function highlightButton(command, highlight) {
    const buttonMap = {
        'forward': 'forwardBtn',
        'backward': 'backwardBtn',
        'left': 'leftBtn',
        'right': 'rightBtn',
        'stop': 'stopBtn'
    };
    
    const btnId = buttonMap[command];
    if (btnId) {
        const btn = document.getElementById(btnId);
        if (highlight) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
}

function highlightAllButtons(highlight) {
    ['forwardBtn', 'backwardBtn', 'leftBtn', 'rightBtn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (highlight) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Start periodic status updates
let statusUpdateInterval;

function startUpdates() {
    statusUpdateInterval = setInterval(updateStatus, config.updateInterval);
}

// Initialize on page load
window.onload = function() {
    updateStatus();
    startUpdates();
    setupButtonEvents();
    addLogMessage('Manual control ready');
    
    // Set initial speed slider value
    speedSlider.value = config.currentSpeed;
    speedValue.textContent = config.currentSpeed;
};

// Cleanup on page unload
window.onbeforeunload = function() {
    sendControlCommand('stop');
};
