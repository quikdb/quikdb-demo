const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('public'));

// Job state
const jobState = {
  startTime: Date.now(),
  executions: 0,
  failed: 0,
  activeReplicas: 3,
  totalReplicas: 3,
  lastNodeFailure: null,
  jobExecutions: [],
  nodes: [
    { id: 1, status: 'active', lastSeen: Date.now() },
    { id: 2, status: 'active', lastSeen: Date.now() },
    { id: 3, status: 'active', lastSeen: Date.now() }
  ]
};

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Calculate uptime
function getUptime() {
  const diff = Date.now() - jobState.startTime;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds, total: diff };
}

// Get time since last failure
function getTimeSinceFailure() {
  if (!jobState.lastNodeFailure) return null;
  const diff = Date.now() - jobState.lastNodeFailure;
  const minutes = Math.floor(diff / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Simulate job execution every 10 seconds
setInterval(() => {
  jobState.executions++;
  const timestamp = new Date().toLocaleTimeString();

  jobState.jobExecutions.unshift({
    time: timestamp,
    status: 'executed',
    replica: Math.floor(Math.random() * jobState.activeReplicas) + 1
  });

  // Keep only last 20 executions
  if (jobState.jobExecutions.length > 20) {
    jobState.jobExecutions.pop();
  }

  broadcast({
    type: 'job_executed',
    execution: jobState.jobExecutions[0]
  });

  broadcast({
    type: 'stats_update',
    stats: getStats()
  });
}, 10000);

// Update uptime every second
setInterval(() => {
  broadcast({
    type: 'uptime_update',
    uptime: getUptime()
  });
}, 1000);

// Get current stats
function getStats() {
  return {
    startTime: jobState.startTime,
    uptime: getUptime(),
    executions: jobState.executions,
    failed: jobState.failed,
    activeReplicas: jobState.activeReplicas,
    totalReplicas: jobState.totalReplicas,
    lastNodeFailure: getTimeSinceFailure(),
    jobExecutions: jobState.jobExecutions,
    nodes: jobState.nodes
  };
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send initial state
  ws.send(JSON.stringify({
    type: 'initial_state',
    stats: getStats()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'disconnect_node') {
        handleNodeDisconnect();
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Handle node disconnect simulation
function handleNodeDisconnect() {
  if (jobState.activeReplicas <= 1) {
    broadcast({
      type: 'error',
      message: 'Cannot disconnect last replica'
    });
    return;
  }

  // Find active node to disconnect
  const activeNode = jobState.nodes.find(n => n.status === 'active');
  if (!activeNode) return;

  activeNode.status = 'disconnected';
  jobState.activeReplicas--;
  jobState.lastNodeFailure = Date.now();

  broadcast({
    type: 'node_disconnected',
    node: activeNode,
    stats: getStats()
  });

  // Add warning to job executions
  jobState.jobExecutions.unshift({
    time: new Date().toLocaleTimeString(),
    status: 'node_dropped',
    replica: activeNode.id
  });

  // Recover node after 30 seconds
  setTimeout(() => {
    activeNode.status = 'active';
    jobState.activeReplicas++;

    broadcast({
      type: 'node_recovered',
      node: activeNode,
      stats: getStats()
    });

    jobState.jobExecutions.unshift({
      time: new Date().toLocaleTimeString(),
      status: 'node_recovered',
      replica: activeNode.id
    });
  }, 30000);
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Demo server running on http://localhost:${PORT}`);
  console.log(`WebSocket server is ready`);
});
