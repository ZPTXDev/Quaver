# Region Affinity Exploration Implementation

## Problem
The region affinity system was purely exploitative - it always selected the node with the best historical ping data. This meant:
- If a US-East node had good affinity data for Singapore region, it would always be selected
- Even if a Singapore node was available, it would never be tried if it had no data
- No mechanism to build affinity data for new nodes or unexplored node-region pairs

## Solution: Epsilon-Greedy Exploration

Added exploration using the epsilon-greedy strategy:

### New Setting
- `regionAffinity.explorationRate` (default: 0.15)
  - Probability (0-1) of selecting an unexplored node
  - 15% chance to explore, 85% chance to exploit best known node
  - Configurable to adjust exploration vs exploitation balance

### Implementation Details

**When selecting a node:**
1. Identify target nodes for the region (from Lavalink config)
2. Build affinity map of nodes with existing data
3. Find unexplored nodes (nodes without any affinity data for this region)
4. With probability `explorationRate`: select random unexplored node
5. Otherwise: select node with best ping from affinity data
6. If no data exists at all: always select unexplored node to bootstrap

**Benefits:**
- Gradually builds affinity data for all available nodes
- Discovers if a closer node (e.g., Singapore for Singapore traffic) performs better
- Self-correcting: as nodes get data, they compete on merit
- Balances: learns about new options while still preferring known-good ones

### Code Changes

**src/schemas/Settings.ts**
- Added `explorationRate` field to regionAffinity settings

**src/lib/music/QuaverCluster.ts**
- Updated `selectNodeByAffinity()` with epsilon-greedy logic
- Updated `selectNodeByRegionPrefix()` with epsilon-greedy logic  
- Added `findUnexploredNodes()` - finds nodes without affinity data for a region
- Added `findUnexploredNodesForRegionPrefix()` - finds nodes without data for a specific prefix
- Added `selectRandomNode()` - randomly selects from unexplored nodes

### How Affinity Data is Collected

Affinity data is already being collected from all connections:

1. **Voice Connection** → Discord assigns media endpoint (e.g., `c-sin13.discord.media`)
2. **ConnectionHealthMonitor** → Extracts region prefix (`c-sin`) and performs periodic health checks
3. **RegionAffinity** → Stores ping data as exponential moving average per node-region pair
4. **Node Selection** → Uses this data with exploration to pick optimal node

Both explicit `rtcRegion` and automatically-assigned endpoints contribute to the same affinity database.

### Tuning

Adjust `explorationRate` based on needs:
- **Higher (0.2-0.3)**: More aggressive exploration, faster discovery of optimal nodes
- **Lower (0.05-0.10)**: More conservative, minimizes suboptimal selections
- **Default (0.15)**: Balanced - explores ~1 in 7 connections while maintaining good performance
