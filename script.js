// Configuration
let config = {
    roverIP: window.location.hostname || '192.168.4.1',
    updateInterval: 500,
    maxSpeed: 200,
    proximityThreshold: 5
};

// Load config from localStorage
if (localStorage.getItem('roverConfig')) {
    config = JSON.parse(localStorage.getItem('roverConfig'));
}

// Map variables
let map;
let roverMarker;
let waypointMarkers = [];
let waypointPolyline;
let waypoints = [];

// State
let isConnected = false;
let autonomousMode = false;

// Initialize map
function initMap() {
    // Default location (Dhaka, Bangladesh)
    map = L.map('map').setView([23.8103, 90.4125], 13);

    // Base layers: OSM, Satellite (Esri), Terrain (Stamen)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 22
    });
    const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 19
    });
    const stamen = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
        attribution: 'Map tiles by Stamen Design, CC BY 3.0 — Map data © OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 18
    });

    // Add default layer and layer control (collapsed on load, positioned top-left to avoid overlap)
    osm.addTo(map);
    L.control.layers({ 'OSM': osm, 'Satellite (Esri)': esri, 'Terrain (Stamen)': stamen }, null, { collapsed: true, position: 'topleft' }).addTo(map);

    // Custom rover icon
    const roverIcon = L.divIcon({
        className: 'rover-marker',
        html: '<div style="background: #4caf50; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    // Initialize rover marker (hidden initially)
    roverMarker = L.marker([0, 0], { icon: roverIcon }).addTo(map);
    roverMarker.setOpacity(0);

    // Click handler for adding waypoints
    map.on('click', function(e) {
        if (!autonomousMode) {
            addWaypoint(e.latlng.lat, e.latlng.lng);
        }
    });
}

// Add waypoint to map
function addWaypoint(lat, lng) {
    waypoints.push({ lat: lat, lon: lng });

    // Add marker
    const waypointIcon = L.divIcon({
        className: 'waypoint-marker',
        html: `<div style="background: #ff9800; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${waypoints.length}</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const marker = L.marker([lat, lng], { icon: waypointIcon }).addTo(map);
    waypointMarkers.push(marker);

    // Update polyline
    updateWaypointPath();
    updateWaypointCount();

    addLogMessage(`Waypoint ${waypoints.length} added: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
}

// Update waypoint path
function updateWaypointPath() {
    if (waypointPolyline) {
        map.removeLayer(waypointPolyline);
    }

    if (waypoints.length > 0) {
        const latLngs = waypoints.map(wp => [wp.lat, wp.lon]);
        waypointPolyline = L.polyline(latLngs, {
            color: '#ff9800',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10'
        }).addTo(map);
    }
}

// Clear all waypoints
function clearWaypoints() {
    waypoints = [];
    waypointMarkers.forEach(marker => map.removeLayer(marker));
    waypointMarkers = [];
    if (waypointPolyline) {
        map.removeLayer(waypointPolyline);
        waypointPolyline = null;
    }
    updateWaypointCount();
    addLogMessage('All waypoints cleared');
}

// Update waypoint count display
function updateWaypointCount() {
    document.getElementById('waypointCount').textContent = waypoints.length;
}

// Send waypoints to rover
function sendWaypoints() {
    if (waypoints.length === 0) {
        alert('No waypoints set! Click on the map to add waypoints.');
        return;
    }

    const waypointsJSON = JSON.stringify(waypoints.map(wp => ({ lat: wp.lat, lon: wp.lon })));

    fetch(`http://${config.roverIP}/api/waypoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: waypointsJSON
    })
    .then(response => response.json())
    .then(data => {
        addLogMessage(`${waypoints.length} waypoints sent to rover`);
    })
    .catch(error => {
        console.error('Send waypoints error:', error);
        addLogMessage(`Error: ${error.message}`);
    });
}

// Start autonomous mode
function startAutonomous() {
    if (waypoints.length === 0) {
        alert('No waypoints set! Click on the map to add waypoints first.');
        return;
    }

    sendWaypoints();

    setTimeout(() => {
        fetch(`http://${config.roverIP}/api/start`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                autonomousMode = true;
                addLogMessage('Autonomous mode started');
                updateModeDisplay();
            })
            .catch(error => {
                console.error('Start autonomous error:', error);
                addLogMessage(`Error: ${error.message}`);
            });
    }, 500);
}

// Stop autonomous mode
function stopAutonomous() {
    fetch(`http://${config.roverIP}/api/stop`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            autonomousMode = false;
            addLogMessage('Autonomous mode stopped');
            updateModeDisplay();
        })
        .catch(error => {
            console.error('Stop autonomous error:', error);
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

            // Update position
            if (data.gpsValid && data.latitude !== 0 && data.longitude !== 0) {
                roverMarker.setLatLng([data.latitude, data.longitude]);
                roverMarker.setOpacity(1);
            }

            // Update status display
            document.getElementById('latitude').textContent = data.latitude.toFixed(7);
            document.getElementById('longitude').textContent = data.longitude.toFixed(7);
            document.getElementById('heading').textContent = data.heading.toFixed(1) + '°';
            document.getElementById('speed').textContent = data.speed.toFixed(2) + ' km/h';
            document.getElementById('satellites').textContent = data.satellites;
            document.getElementById('gpsStatus').textContent = data.gpsValid ? '✓ Valid' : '✗ Invalid';
            
            autonomousMode = data.autonomousMode;
            updateModeDisplay();

            if (data.autonomousMode) {
                document.getElementById('waypoint').textContent = 
                    `${data.currentWaypoint + 1} / ${data.totalWaypoints}`;
                document.getElementById('distanceToTarget').textContent = 
                    data.distanceToTarget.toFixed(2) + ' m';
            } else {
                document.getElementById('waypoint').textContent = '--';
                document.getElementById('distanceToTarget').textContent = '--';
            }
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

// Update mode display
function updateModeDisplay() {
    document.getElementById('mode').textContent = autonomousMode ? 'Autonomous' : 'Manual';
}

// Center map on rover
function centerMapOnRover() {
    const pos = roverMarker.getLatLng();
    if (pos.lat !== 0 && pos.lng !== 0) {
        map.setView(pos, 18);
    }
}

// Add log message
function addLogMessage(message) {
    const logContainer = document.getElementById('activityLog');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    if (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
    }
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Fetch activity log from rover
function fetchActivityLog() {
    fetch(`http://${config.roverIP}/api/log`)
        .then(response => response.json())
        .then(logs => {
            const logContainer = document.getElementById('activityLog');
            logContainer.innerHTML = '';
            
            logs.forEach(log => {
                const logEntry = document.createElement('p');
                logEntry.textContent = log;
                logContainer.appendChild(logEntry);
            });
            
            logContainer.scrollTop = logContainer.scrollHeight;
        })
        .catch(error => {
            console.error('Fetch log error:', error);
        });
}

// Settings modal
const modal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeBtn = document.getElementsByClassName('close')[0];

settingsBtn.onclick = function() {
    // Populate form with current config
    document.getElementById('roverIP').value = config.roverIP;
    document.getElementById('updateInterval').value = config.updateInterval;
    document.getElementById('maxSpeed').value = config.maxSpeed;
    document.getElementById('proximityThreshold').value = config.proximityThreshold;
    
    modal.style.display = 'block';
}

closeBtn.onclick = function() {
    modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// Save settings
document.getElementById('settingsForm').onsubmit = function(e) {
    e.preventDefault();
    
    config.roverIP = document.getElementById('roverIP').value;
    config.updateInterval = parseInt(document.getElementById('updateInterval').value);
    config.maxSpeed = parseInt(document.getElementById('maxSpeed').value);
    config.proximityThreshold = parseInt(document.getElementById('proximityThreshold').value);
    
    localStorage.setItem('roverConfig', JSON.stringify(config));
    
    modal.style.display = 'none';
    addLogMessage('Settings saved');
    
    // Restart update interval
    clearInterval(statusUpdateInterval);
    clearInterval(logUpdateInterval);
    startUpdates();
}

// Event listeners for autonomous control buttons
document.getElementById('startAutoBtn').addEventListener('click', startAutonomous);
document.getElementById('stopAutoBtn').addEventListener('click', stopAutonomous);

document.getElementById('centerMapBtn').addEventListener('click', centerMapOnRover);
document.getElementById('clearWaypointsBtn').addEventListener('click', clearWaypoints);

// Start periodic updates
let statusUpdateInterval;
let logUpdateInterval;

function startUpdates() {
    statusUpdateInterval = setInterval(updateStatus, config.updateInterval);
    logUpdateInterval = setInterval(fetchActivityLog, 5000);
}

// Initialize on page load
window.onload = function() {
    initMap();
    updateStatus();
    fetchActivityLog();
    startUpdates();
    addLogMessage('Control panel initialized');
};
