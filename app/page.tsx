'use client';

import { useEffect, useState } from 'react';

interface Stats {
  uptime: { hours: number; minutes: number; seconds: number };
  executions: number;
  failed: number;
  activeReplicas: number;
  totalReplicas: number;
  lastNodeFailure: string | null;
  jobExecutions: Array<{
    time: string;
    status: string;
    replica: number;
  }>;
  nodes: Array<{
    id: number;
    status: 'active' | 'disconnected';
  }>;
}

const subtitles = [
  "No servers to manage.",
  "No one on call.",
  "No missed runs."
];

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [isBreakDisabled, setIsBreakDisabled] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState('');

  // Poll for stats every 2 seconds
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  // Rotate subtitles every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSubtitleIndex((prev) => (prev + 1) % subtitles.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (uptime: { hours: number; minutes: number; seconds: number }) => {
    const h = String(uptime.hours).padStart(2, '0');
    const m = String(uptime.minutes).padStart(2, '0');
    const s = String(uptime.seconds).padStart(2, '0');
    return `${h}h ${m}m ${s}s`;
  };

  const handleBreakClick = async () => {
    setIsBreakDisabled(true);
    setChallengeStatus('Disconnecting node...');

    try {
      const response = await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_node' })
      });

      const data = await response.json();

      if (data.success) {
        setChallengeStatus(`Node ${data.node.id} disconnected. Job still running!`);
        setStats(data.stats);
      } else {
        setChallengeStatus(data.error || 'Error');
      }
    } catch (error) {
      setChallengeStatus('Error disconnecting node');
    }

    setTimeout(() => {
      setIsBreakDisabled(false);
      setChallengeStatus('');
    }, 5000);
  };

  const getExecutionIcon = (status: string) => {
    if (status === 'node_dropped') return '⚠';
    if (status === 'node_recovered') return '✔';
    return '✓';
  };

  const getExecutionText = (execution: { status: string; replica: number }) => {
    if (execution.status === 'node_dropped') return `node ${execution.replica} dropped`;
    if (execution.status === 'node_recovered') return `node ${execution.replica} recovered`;
    return `job executed (replica ${execution.replica})`;
  };

  if (!stats) {
    return (
      <div className="container">
        <div className="headline">
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* CTA Banner - Top */}
      <div className="cta-banner">
        <div className="cta-content">
          <span>What's your question? Stop by and ask us anything.</span>
          <span>What's your question? Stop by and ask us anything.</span>
          <span>What's your question? Stop by and ask us anything.</span>
        </div>
      </div>

      {/* Headline */}
      <div className="headline">
        <h1>THIS JOB HAS BEEN RUNNING ALL DAY</h1>
        <p className="subtitle">{subtitles[subtitleIndex]}</p>
      </div>

      {/* Main content - 5 section grid layout */}
      <div className="main-content">
        {/* Stats - Top Left */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">UPTIME</div>
            <div className="stat-value large">{formatUptime(stats.uptime)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">EXECUTIONS</div>
            <div className="stat-value">{stats.executions.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">FAILED</div>
            <div className="stat-value">{stats.failed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">ACTIVE REPLICAS</div>
            <div className="stat-value">{stats.activeReplicas}</div>
          </div>
        </div>

        {/* Feed - Bottom Left */}
        <div className="feed-section">
          <h2>LIVE EXECUTION FEED</h2>
          <div className="feed">
            {stats.jobExecutions.length === 0 ? (
              <div className="feed-item waiting">Waiting for first execution...</div>
            ) : (
              stats.jobExecutions.map((execution, index) => (
                <div key={index} className={`feed-item ${execution.status.replace('_', '-')}`}>
                  <span className="icon">{getExecutionIcon(execution.status)}</span>
                  <span className="time">{execution.time}</span>
                  <span className="status">{getExecutionText(execution)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center - Big Button */}
        <div className="challenge">
          <h2>TRY TO BREAK THIS JOB</h2>
          <p className="challenge-subtitle">Disconnect a node. The job will keep running.</p>
          <button
            className="break-button"
            onClick={handleBreakClick}
            disabled={isBreakDisabled}
          >
            DISCONNECT A NODE
          </button>
          <div className="challenge-status">{challengeStatus}</div>
        </div>

        {/* Nodes - Top Right */}
        <div className="nodes-section">
          <h3>NODE STATUS</h3>
          <div className="nodes">
            {stats.nodes.map((node) => (
              <div key={node.id} className={`node ${node.status}`}>
                <div className="node-id">Node {node.id}</div>
                <div className="node-status">
                  {node.status === 'active' ? 'ACTIVE' : 'DISCONNECTED'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info - Bottom Right */}
        <div className="info-section">
          <h3>ALWAYS ON</h3>
          <p>Zero downtime. Zero failures. Even when infrastructure fails.</p>
        </div>
      </div>
    </div>
  );
}
