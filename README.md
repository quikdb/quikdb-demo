# QuikDB Demo - This Job Never Stops

An interactive Next.js demonstration showcasing QuikDB's always-on reliability and fault tolerance. Built as a single-page, no-scroll experience and deployed on QuikDB infrastructure.

## 🎯 What This Demo Shows

This demo runs a simulated always-on job that:
- Executes every 10 seconds
- Continues running even when nodes fail
- Auto-recovers from failures
- Never misses a beat

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- Yarn package manager
- A modern web browser

### Local Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev
```

Visit `http://localhost:3000`

### Build for Production

```bash
# Build the application
yarn build

# Start production server
yarn start
```

## 🌐 Production deployment

Production deployment is owned by `quikdb-infra/applications/demo/`. Its GitHub Actions workflow
builds this repository as a container, pushes the image to QuikDB's ECR repository, and deploys the
single-replica workload to the shared EKS cluster behind `demo.quikdb.com`.

## 📋 Features

### Live Stats Dashboard
- **Real-time uptime counter** - Shows how long the job has been running
- **Execution count** - Total number of successful job runs
- **Failed runs** - Always zero (because QuikDB doesn't fail)
- **Active replicas** - Current number of running nodes
- **Last failure time** - When the last node dropped (if any)

### Live Execution Feed
- Shows every job execution in real-time
- Displays node failures and recoveries
- Updates every 10 seconds
- Logs are color-coded for easy scanning

### Interactive Challenge
The big red button lets visitors:
1. Disconnect a node from the system
2. Watch the job continue running
3. See the node automatically recover after 30 seconds

This proves the fault tolerance in action.

### Node Status Display
Shows all 3 replica nodes and their current status (active/disconnected)

## 🎨 Design Philosophy

The demo follows key principles:

### No Jargon
- Uses plain language
- No buzzwords like "distributed" or "decentralized"
- Focuses on outcomes, not architecture

### Visual First
- Big, readable text
- Clean dark theme optimized for display screens
- Color-coded status indicators

### Self-Explanatory
- Visitors understand it without explanation
- Creates natural curiosity
- Prompts the question: "How?"

## 💡 Using This at Events

### Setup Tips

1. **Large Display**
   - Use the biggest screen available
   - Full-screen the browser (F11)
   - Disable sleep mode

2. **Placement**
   - High-traffic area
   - Eye-level positioning
   - Near your booth/table

3. **Let It Run**
   - Start it in the morning
   - Let the uptime counter grow
   - Don't restart unnecessarily

### Conversation Starters

When people stop to look:

**Opening line:**
> "QuikDB runs background work on an always-on network so it keeps going even when machines fail."

**Follow-up question:**
> "Do you run anything that can't afford to stop?"

**Call to action:**
> "Want to try running one of your jobs on it?"

## 🔧 Technical Details

### Architecture

- **Framework**: Next.js 14 (App Router)
- **Styling**: CSS with global styles
- **API**: Next.js API Routes with polling
- **Deployment**: Standalone Next.js container on QuikDB EKS

### File Structure

```
quikdb-demo/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main demo page (client component)
│   ├── globals.css         # Global styles
│   └── api/
│       └── stats/
│           └── route.ts    # API endpoint for stats
├── next.config.js
├── tsconfig.json
├── package.json
└── README.md
```

### How It Works

1. **Server State**: API route maintains job state in memory
2. **Polling**: Client polls `/api/stats` every 2 seconds
3. **Simulation**: Job executions happen every 10 seconds
4. **Auto-recovery**: Disconnected nodes recover after 30 seconds

**Note**: Server state resets on each deployment. This is intentional for demo purposes.

## 🎬 What Visitors See

### First Impression (3 seconds)
A large headline: **"THIS JOB HAS BEEN RUNNING ALL DAY"**

### Engagement (10 seconds)
Live stats showing uptime, executions, and node status

### Curiosity (30 seconds)
Feed showing jobs executing every 10 seconds

### Action (1 minute)
Big button inviting them to "try to break it"

### Understanding (2 minutes)
They press the button, see a node disconnect, watch the job continue running

### Conversion
They ask: "What is this?" or "How does this work?"

## 📊 Success Metrics

Track these to measure demo effectiveness:
- Number of times "break" button is pressed
- Time visitors spend watching the feed
- Number of conversations started
- Follow-up questions about QuikDB

## 🛠️ Troubleshooting

**Development server won't start:**
- Make sure you're using Node.js 16+
- Delete `.next` folder and try again
- Run `yarn install` to ensure dependencies are installed

**Stats not updating:**
- Check browser console for errors
- Verify the API route is accessible at `/api/stats`
- Check Network tab for failed requests

**Button doesn't work:**
- Check if a node is already disconnected
- Wait for previous recovery to complete
- Check API response in Network tab

**Build fails:**
- Run `yarn install` to update dependencies
- Check for TypeScript errors
- Clear `.next` folder and rebuild

## 📝 License

MIT

## 🤝 Contributing

This is a demo application. For production QuikDB integration, see the main QuikDB documentation.

---

**Built to demonstrate QuikDB's always-on reliability**
