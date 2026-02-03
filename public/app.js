// WebSocket connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

// DOM elements
const uptimeEl = document.getElementById('uptime');
const executionsEl = document.getElementById('executions');
const failedEl = document.getElementById('failed');
const activeReplicasEl = document.getElementById('active-replicas');
const lastFailureEl = document.getElementById('last-failure');
const feedEl = document.getElementById('feed');
const breakButton = document.getElementById('break-button');
const challengeStatus = document.getElementById('challenge-status');
const nodesEl = document.getElementById('nodes');
const subtitleEl = document.getElementById('rotating-subtitle');

// Rotating subtitles
const subtitles = [
    "No servers to manage.",
    "No one on call.",
    "No missed runs."
];
let subtitleIndex = 0;

// Rotate subtitles every 10 seconds
setInterval(() => {
    subtitleIndex = (subtitleIndex + 1) % subtitles.length;
    subtitleEl.style.opacity = '0';

    setTimeout(() => {
        subtitleEl.textContent = subtitles[subtitleIndex];
        subtitleEl.style.opacity = '1';
    }, 500);
}, 10000);

// Format uptime
function formatUptime(uptime) {
    const h = String(uptime.hours).padStart(2, '0');
    const m = String(uptime.minutes).padStart(2, '0');
    const s = String(uptime.seconds).padStart(2, '0');
    return `${h}h ${m}m ${s}s`;
}

// Update stats display
function updateStats(stats) {
    executionsEl.textContent = stats.executions.toLocaleString();
    failedEl.textContent = stats.failed;
    activeReplicasEl.textContent = stats.activeReplicas;
    lastFailureEl.textContent = stats.lastNodeFailure || 'Never';
}

// Update uptime display
function updateUptime(uptime) {
    uptimeEl.textContent = formatUptime(uptime);
}

// Add feed item
function addFeedItem(execution) {
    const item = document.createElement('div');
    item.className = `feed-item ${execution.status.replace('_', '-')}`;

    let icon = '✓';
    let statusText = 'job executed';

    if (execution.status === 'node_dropped') {
        icon = '⚠';
        statusText = `node ${execution.replica} dropped`;
    } else if (execution.status === 'node_recovered') {
        icon = '✔';
        statusText = `node ${execution.replica} recovered`;
    } else if (execution.status === 'executed') {
        statusText = `job executed (replica ${execution.replica})`;
    }

    item.innerHTML = `
        <span class="icon">${icon}</span>
        <span class="time">${execution.time}</span>
        <span class="status">${statusText}</span>
    `;

    // Remove waiting message if present
    const waiting = feedEl.querySelector('.waiting');
    if (waiting) {
        waiting.remove();
    }

    feedEl.insertBefore(item, feedEl.firstChild);

    // Keep only last 20 items
    while (feedEl.children.length > 20) {
        feedEl.removeChild(feedEl.lastChild);
    }
}

// Update nodes display
function updateNodes(nodes) {
    nodesEl.innerHTML = '';

    nodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = `node ${node.status}`;
        nodeEl.innerHTML = `
            <div class="node-id">Node ${node.id}</div>
            <div class="node-status">${node.status === 'active' ? 'ACTIVE' : 'DISCONNECTED'}</div>
        `;
        nodesEl.appendChild(nodeEl);
    });
}

// Handle break button click
breakButton.addEventListener('click', () => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'disconnect_node' }));
        breakButton.disabled = true;
        challengeStatus.textContent = 'Disconnecting node...';

        setTimeout(() => {
            breakButton.disabled = false;
            challengeStatus.textContent = '';
        }, 5000);
    }
});

// WebSocket event handlers
ws.onopen = () => {
    console.log('Connected to demo server');
};

ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'initial_state':
                updateStats(data.stats);
                updateUptime(data.stats.uptime);
                updateNodes(data.stats.nodes);

                // Load existing feed items
                data.stats.jobExecutions.reverse().forEach(execution => {
                    addFeedItem(execution);
                });
                break;

            case 'stats_update':
                updateStats(data.stats);
                break;

            case 'uptime_update':
                updateUptime(data.uptime);
                break;

            case 'job_executed':
                addFeedItem(data.execution);
                break;

            case 'node_disconnected':
                challengeStatus.textContent = `Node ${data.node.id} disconnected. Job still running!`;
                updateStats(data.stats);
                updateNodes(data.stats.nodes);
                break;

            case 'node_recovered':
                challengeStatus.textContent = `Node ${data.node.id} recovered!`;
                updateStats(data.stats);
                updateNodes(data.stats.nodes);

                setTimeout(() => {
                    challengeStatus.textContent = '';
                }, 5000);
                break;

            case 'error':
                challengeStatus.textContent = data.message;
                setTimeout(() => {
                    challengeStatus.textContent = '';
                }, 3000);
                break;
        }
    } catch (err) {
        console.error('Error handling message:', err);
    }
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    challengeStatus.textContent = 'Connection error. Refresh the page.';
};

ws.onclose = () => {
    console.log('Disconnected from demo server');
    challengeStatus.textContent = 'Connection lost. Refresh the page.';
};

// Handle page visibility to reconnect if needed
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ws.readyState !== WebSocket.OPEN) {
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
});
