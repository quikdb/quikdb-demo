import { NextResponse } from 'next/server';

// In-memory state (resets on deployment)
let jobState = {
  startTime: Date.now(),
  executions: 0,
  failed: 0,
  activeReplicas: 3,
  totalReplicas: 3,
  lastNodeFailure: null as number | null,
  lastExecution: Date.now(),
  nodes: [
    { id: 1, status: 'active' as 'active' | 'disconnected', disconnectedAt: null as number | null },
    { id: 2, status: 'active' as 'active' | 'disconnected', disconnectedAt: null as number | null },
    { id: 3, status: 'active' as 'active' | 'disconnected', disconnectedAt: null as number | null }
  ],
  jobExecutions: [] as Array<{
    time: string;
    status: string;
    replica: number;
  }>
};

// Calculate uptime
function getUptime() {
  const diff = Date.now() - jobState.startTime;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds };
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

// Simulate job execution (every 10 seconds)
function simulateExecution() {
  const now = Date.now();
  const timeSinceLastExecution = now - jobState.lastExecution;

  if (timeSinceLastExecution >= 10000) {
    jobState.executions++;
    jobState.lastExecution = now;

    const timestamp = new Date().toLocaleTimeString();
    const activeNodes = jobState.nodes.filter(n => n.status === 'active');
    const replica = activeNodes.length > 0
      ? activeNodes[Math.floor(Math.random() * activeNodes.length)].id
      : 1;

    jobState.jobExecutions.unshift({
      time: timestamp,
      status: 'executed',
      replica
    });

    // Keep only last 15 executions
    if (jobState.jobExecutions.length > 15) {
      jobState.jobExecutions.pop();
    }
  }
}

// Auto-recover disconnected nodes (after 30 seconds)
function checkNodeRecovery() {
  const now = Date.now();
  jobState.nodes.forEach(node => {
    if (node.status === 'disconnected' && node.disconnectedAt) {
      const timeSinceDisconnect = now - node.disconnectedAt;
      if (timeSinceDisconnect >= 30000) {
        node.status = 'active';
        node.disconnectedAt = null;
        jobState.activeReplicas++;

        const timestamp = new Date().toLocaleTimeString();
        jobState.jobExecutions.unshift({
          time: timestamp,
          status: 'node_recovered',
          replica: node.id
        });

        if (jobState.jobExecutions.length > 15) {
          jobState.jobExecutions.pop();
        }
      }
    }
  });
}

// GET request - return current stats
export async function GET() {
  simulateExecution();
  checkNodeRecovery();

  return NextResponse.json({
    uptime: getUptime(),
    executions: jobState.executions,
    failed: jobState.failed,
    activeReplicas: jobState.activeReplicas,
    totalReplicas: jobState.totalReplicas,
    lastNodeFailure: getTimeSinceFailure(),
    jobExecutions: jobState.jobExecutions,
    nodes: jobState.nodes
  });
}

// POST request - disconnect a node
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'disconnect_node') {
      if (jobState.activeReplicas <= 1) {
        return NextResponse.json(
          { error: 'Cannot disconnect last replica' },
          { status: 400 }
        );
      }

      // Find active node to disconnect
      const activeNode = jobState.nodes.find(n => n.status === 'active');
      if (activeNode) {
        activeNode.status = 'disconnected';
        activeNode.disconnectedAt = Date.now();
        jobState.activeReplicas--;
        jobState.lastNodeFailure = Date.now();

        const timestamp = new Date().toLocaleTimeString();
        jobState.jobExecutions.unshift({
          time: timestamp,
          status: 'node_dropped',
          replica: activeNode.id
        });

        if (jobState.jobExecutions.length > 15) {
          jobState.jobExecutions.pop();
        }

        return NextResponse.json({
          success: true,
          node: activeNode,
          stats: {
            uptime: getUptime(),
            executions: jobState.executions,
            failed: jobState.failed,
            activeReplicas: jobState.activeReplicas,
            totalReplicas: jobState.totalReplicas,
            lastNodeFailure: getTimeSinceFailure(),
            jobExecutions: jobState.jobExecutions,
            nodes: jobState.nodes
          }
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
