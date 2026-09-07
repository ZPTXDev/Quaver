import type { QuaverClient } from '#src/lib';
import { TypedEmitter } from 'tiny-typed-emitter';
import type { NodeOptions, NodeEvents } from 'lavaclient';
import { QuaverNode } from './QuaverNode';
import { ClusterPlayerManager } from './ClusterPlayerManager';
import { Penalties } from './Penalties';
import type { RegionAffinity } from './RegionAffinity';
import { settings } from '../util';
import { logger } from '../logger';

export interface QuaverClusterNodeOptions {
    info: NodeOptions['info'];
    ws?: NodeOptions['ws'];
    rest?: NodeOptions['rest'];
    region: string;
}

export interface QuaverClusterOptions {
    nodes: QuaverClusterNodeOptions[];
    discord: NodeOptions['discord'];
}

/**
 * QuaverCluster manages multiple QuaverNode instances for multi-region Lavalink connectivity.
 * Provides region-aware node selection with automatic fallback to available nodes.
 */
export class QuaverCluster extends TypedEmitter<NodeEvents> {
    readonly client: QuaverClient;
    readonly nodes: Map<string, QuaverNode>;
    readonly regionMap: Map<string, string[]>;
    readonly players: ClusterPlayerManager;
    private regionAffinity: RegionAffinity | null;
    private pruneInterval?: ReturnType<typeof setInterval>;
    private affinityCache: Map<string, { nodeId: string; regionPrefix: string; avgPing: number; lastUpdated: number }> = new Map();

    constructor(options: QuaverClusterOptions, client: QuaverClient, regionAffinity: RegionAffinity | null = null) {
        super();
        this.client = client;
        this.nodes = new Map();
        this.regionMap = new Map();
        this.regionAffinity = regionAffinity;

        // Create QuaverNode instances for each configured node
        options.nodes.forEach((nodeConfig): void => {
            // Use host:port as node ID for stability and uniqueness
            const nodeId = `${nodeConfig.info.host}:${nodeConfig.info.port}`;
            const node = new QuaverNode(
                {
                    info: nodeConfig.info,
                    discord: options.discord,
                    ws: nodeConfig.ws,
                    rest: nodeConfig.rest,
                },
                client,
            );

            this.nodes.set(nodeId, node);

            // Forward all events from individual nodes to the cluster
            // This ensures music events work correctly in multi-node mode
            node.on('trackStart', (player, track): void => {
                this.emit('trackStart', player, track);
            });
            node.on('trackEnd', (player, track): void => {
                this.emit('trackEnd', player, track);
            });
            node.on('trackStuck', (player, track, threshold): void => {
                this.emit('trackStuck', player, track, threshold);
            });
            node.on('trackException', (player, track, exception): void => {
                this.emit('trackException', player, track, exception);
            });
            node.on('queueFinish', (player): void => {
                this.emit('queueFinish', player);
            });
            node.on('error', (player, error): void => {
                this.emit('error', player, error);
            });
            node.on('connected', (player, voice): void => {
                this.emit('connected', player, voice);
            });
            node.on('disconnected', (player): void => {
                this.emit('disconnected', player);
            });
            node.on('ready', (player): void => {
                this.emit('ready', player);
            });

            // Handle WebSocket connection errors to prevent crashes
            // These are connection-level errors (ECONNREFUSED, etc), not player errors
            node.ws.on('error', (error: Error): void => {
                logger.error({
                    message: `WebSocket error for node ${nodeId}: ${error.message}`,
                    label: 'Lavalink',
                    error,
                });
            });

            node.ws.on('disconnected', (event): void => {
                logger.warn({
                    message: `Node ${nodeId} disconnected (code: ${event.code}, reconnecting: ${event.reconnecting})`,
                    label: 'Lavalink',
                });

                // If not reconnecting or resuming, migrate active players to another node
                if (!event.reconnecting) {
                    void this.migratePlayersFromNode(nodeId, node);
                }
            });

            node.ws.on('connected', (event): void => {
                logger.info({
                    message: `Node ${nodeId} connected (reconnected: ${event.reconnected}, took: ${event.took}ms)`,
                    label: 'Lavalink',
                });
            });

            // Build region mapping: region -> [nodeId1, nodeId2, ...]
            const nodeIds = this.regionMap.get(nodeConfig.region) || [];
            nodeIds.push(nodeId);
            this.regionMap.set(nodeConfig.region, nodeIds);
        });

        // Create cluster player manager that routes operations across nodes
        this.players = new ClusterPlayerManager(this);

        // Validate and warn about duplicate regions
        for (const [region, nodeIds] of this.regionMap.entries()) {
            if (nodeIds.length > 1) {
                logger.warn(`Multiple nodes (${nodeIds.join(', ')}) configured for region '${region}'. Load balancing will distribute players across these nodes.`);
            }
        }

        // Set up periodic pruning and cache refresh for affinity data if enabled
        if (this.regionAffinity && settings.regionAffinity?.enabled) {
            const staleAfterMs = settings.regionAffinity.staleAfterMs ?? 300000;
            const refreshSeconds = settings.regionAffinity.refreshSeconds ?? 30;
            
            // Initial cache refresh
            void this.refreshAffinityCache();

            this.pruneInterval = setInterval((): void => {
                // Run operations sequentially to avoid race conditions
                void (async (): Promise<void> => {
                    try {
                        // Prune stale entries first
                        await this.regionAffinity?.pruneStaleEntries(staleAfterMs);
                        // Then refresh cache
                        await this.refreshAffinityCache();
                    } catch (err) {
                        logger.error({ message: 'Failed to refresh affinity data', label: 'QuaverCluster', error: err });
                    }
                })();
            }, refreshSeconds * 1000);

            logger.info('Region affinity pruning and caching scheduled');
        }
    }

    /**
     * Migrate active players from a failed node to other available nodes
     */
    private async migratePlayersFromNode(failedNodeId: string, failedNode: QuaverNode): Promise<void> {
        const activePlayers = Array.from(failedNode.players.cache.values());
        if (activePlayers.length === 0) return;

        logger.info(`Migrating ${activePlayers.length} player(s) from failed node ${failedNodeId}`);

        for (const player of activePlayers) {
            try {
                // Check if there are other nodes available
                if (this.nodes.size <= 1) {
                    logger.warn(`Cannot migrate player for guild ${player.guildId}: no other nodes available`);
                    continue;
                }

                // Get the guild to determine voice region
                const guild = this.client.guilds.cache.get(player.guildId);
                if (!guild) {
                    logger.warn(`Cannot migrate player for guild ${player.guildId}: guild not found`);
                    continue;
                }

                // Select a new node (exclude the failed one)
                const voiceChannel = guild.members.me?.voice?.channel;
                const region = voiceChannel?.rtcRegion ?? null;
                const regionPrefix = region ? null : this.players['guildRegionPrefixMap'].get(player.guildId) ?? null;
                let newNode = this.getNodeForRegion(region, regionPrefix);

                // If we got the same failed node, try to get any other available node
                if (newNode === failedNode) {
                    for (const [id, node] of this.nodes.entries()) {
                        if (id !== failedNodeId && this.isNodeReady(node)) {
                            newNode = node;
                            break;
                        }
                    }
                }

                if (!newNode || newNode === failedNode) {
                    logger.warn(`Cannot migrate player for guild ${player.guildId}: no suitable node available`);
                    continue;
                }

                // Save current player state
                const queue = player.queue;
                const currentTrack = queue.current;
                const position = player.position;
                const volume = player.volume;
                const paused = player.paused;
                const filters = player.filters;

                // Remove from failed node's player cache
                failedNode.players.cache.delete(player.guildId);

                // Create new player on the new node
                const newPlayer = newNode.players.create(guild);

                // Update cluster's guild-to-node mapping
                const newNodeId = Array.from(this.nodes.entries())
                    .find(([, n]: [string, QuaverNode]): boolean => n === newNode)?.[0];
                if (newNodeId) {
                    this.players['guildNodeMap'].set(player.guildId, newNodeId);
                }

                // Reconnect to voice
                await newPlayer.connect(player.voiceChannelId);

                // Restore queue
                if (currentTrack) {
                    queue.tracks.unshift(currentTrack);
                }
                for (const track of queue.tracks) {
                    newPlayer.queue.add(track);
                }

                // Restore filters
                if (filters) {
                    await newPlayer.setFilters(filters);
                }

                // Restore volume
                if (volume !== 100) {
                    await newPlayer.setVolume(volume);
                }

                // Start playback from saved position
                if (currentTrack && newPlayer.queue.tracks.length > 0) {
                    await newPlayer.play();
                    if (position > 0) {
                        await newPlayer.seek(position);
                    }
                    if (paused) {
                        await newPlayer.pause(true);
                    }
                }

                // Notify the user about migration
                const textChannel = guild.channels.cache.get(player.textChannelId);
                if (textChannel?.isTextBased()) {
                    await textChannel.send({
                        content: this.client.locale(guild.id, 'MUSIC.NODE_MIGRATION'),
                    });
                }

                logger.info(`Successfully migrated player for guild ${player.guildId} from ${failedNodeId} to ${newNodeId}`);
            } catch (error) {
                logger.error(`Failed to migrate player for guild ${player.guildId}:`, error);
            }
        }
    }

    /**
     * Refreshes the in-memory cache of affinity data for synchronous access.
     */
    private async refreshAffinityCache(): Promise<void> {
        if (!this.regionAffinity) return;

        try {
            const staleAfterMs = settings.regionAffinity?.staleAfterMs ?? 300000;
            const allNodes = await this.regionAffinity.getAllNodes(staleAfterMs);
            
            // Build new cache (don't clear in-place to avoid race conditions)
            const newCache = new Map<string, { nodeId: string; regionPrefix: string; avgPing: number; lastUpdated: number }>();
            
            // Populate new cache with compound keys: nodeId:regionPrefix
            for (const { nodeId, regionPrefix, data } of allNodes) {
                const key = `${nodeId}:${regionPrefix}`;
                newCache.set(key, {
                    nodeId,
                    regionPrefix,
                    avgPing: data.avgPing,
                    lastUpdated: data.lastUpdated,
                });
            }
            
            // Atomically replace the cache reference
            this.affinityCache = newCache;
            
            logger.debug(`Affinity cache refreshed with ${allNodes.length} entries`);
        } catch (error) {
            logger.warn({ message: 'Failed to refresh affinity cache', label: 'QuaverCluster', error });
        }
    }

    /**
     * Gets the best node for a given Discord voice region using affinity-based or penalty-based selection.
     * Priority:
     * 1. Affinity-based selection (if enabled and data available)
     * 2. Region-based penalty selection
     * 3. Global penalty-based load balancing
     *
     * @param region - The Discord rtcRegion (e.g., "singapore")
     * @param regionPrefix - The Discord media endpoint region prefix (e.g., "c-sin"), used for affinity when rtcRegion is null
     */
    getNodeForRegion(region?: string | null, regionPrefix?: string | null): QuaverNode | undefined {
        // Try affinity-based selection first if enabled and region is specified
        if (region && this.regionAffinity && settings.regionAffinity?.enabled) {
            const affinityNode = this.selectNodeByAffinity(region);
            if (affinityNode) {
                return affinityNode;
            }
        }

        // If no rtcRegion but we have a region prefix from historical data, use affinity-based selection
        if (!region && regionPrefix && this.regionAffinity && settings.regionAffinity?.enabled) {
            const affinityNode = this.selectNodeByRegionPrefix(regionPrefix);
            if (affinityNode) {
                return affinityNode;
            }
        }

        // If no region specified, use penalty-based load balancing across all nodes
        if (!region) {
            return this.getNextAvailableNode();
        }

        // Find nodes that serve this region
        const nodeIds = this.regionMap.get(region);
        if (nodeIds && nodeIds.length > 0) {
            // Collect all ready nodes for this region
            const readyNodes: QuaverNode[] = [];
            for (const nodeId of nodeIds) {
                const node = this.nodes.get(nodeId);
                if (node && this.isNodeReady(node)) {
                    readyNodes.push(node);
                }
            }

            // Use penalty-based selection to find the best node
            if (readyNodes.length > 0) {
                return Penalties.findBestNode(readyNodes);
            }
        }

        // Fallback to any available node
        return this.getNextAvailableNode();
    }

    /**
     * Selects a node based on region affinity data (ping measurements) using cached data.
     * Only considers nodes that serve the specified target region.
     * Uses epsilon-greedy exploration to try nodes without affinity data.
     * @param targetRegion - The Lavalink configured region to filter nodes by (e.g., "singapore")
     * @returns The best node for the target region, or null if no affinity data available
     */
    private selectNodeByAffinity(targetRegion: string | null): QuaverNode | null {
        if (!this.regionAffinity || !targetRegion) return null;

        const targetNodeIds = this.regionMap.get(targetRegion);
        if (!targetNodeIds || targetNodeIds.length === 0) return null;

        const nodeAffinityMap = this.buildNodeAffinityMap(targetNodeIds);
        const unexploredNodes = this.findUnexploredNodes(targetNodeIds, nodeAffinityMap);

        // Epsilon-greedy: explore nodes without data with probability explorationRate
        const explorationRate = settings.regionAffinity?.explorationRate ?? 0.15;
        if (unexploredNodes.length > 0 && Math.random() < explorationRate) {
            logger.debug(`Exploring unexplored node for region ${targetRegion} (exploration rate: ${explorationRate})`);
            return this.selectRandomNode(unexploredNodes);
        }

        // No affinity data at all and no unexplored nodes - use penalty-based selection
        if (nodeAffinityMap.size === 0 && unexploredNodes.length === 0) return null;

        // If we have no affinity data but have unexplored nodes, pick one to start building data
        if (nodeAffinityMap.size === 0) {
            logger.debug(`No affinity data for region ${targetRegion}, selecting unexplored node to build data`);
            return this.selectRandomNode(unexploredNodes);
        }

        // Use existing affinity data for exploitation
        const candidateNodes = this.collectCandidateNodes(nodeAffinityMap);
        const selectedNodes = this.selectNodesWithinThreshold(candidateNodes);

        return this.selectBestNodeFromCandidates(selectedNodes);
    }

    /**
     * Selects a node based on region prefix from Discord media endpoint (e.g., "c-sin").
     * Used when rtcRegion is null but we have historical media endpoint data.
     * Uses epsilon-greedy exploration to try nodes without affinity data.
     * @param regionPrefix - The Discord media endpoint region prefix (e.g., "c-sin")
     * @returns The best node for the region prefix, or null if no affinity data available
     */
    private selectNodeByRegionPrefix(regionPrefix: string): QuaverNode | null {
        if (!this.regionAffinity) return null;

        // Find all nodes that have affinity data for this region prefix
        const nodeAffinityMap = new Map<string, { node: QuaverNode; minPing: number }>();
        const allNodeIds = Array.from(this.nodes.keys());

        for (const affinityData of this.affinityCache.values()) {
            if (affinityData.regionPrefix !== regionPrefix) continue;

            const node = this.nodes.get(affinityData.nodeId);
            if (!node || !this.isNodeReady(node)) continue;

            const existing = nodeAffinityMap.get(affinityData.nodeId);
            if (existing) {
                existing.minPing = Math.min(existing.minPing, affinityData.avgPing);
            } else {
                nodeAffinityMap.set(affinityData.nodeId, { node, minPing: affinityData.avgPing });
            }
        }

        const unexploredNodes = this.findUnexploredNodesForRegionPrefix(allNodeIds, regionPrefix);

        // Epsilon-greedy: explore nodes without data with probability explorationRate
        const explorationRate = settings.regionAffinity?.explorationRate ?? 0.15;
        if (unexploredNodes.length > 0 && Math.random() < explorationRate) {
            logger.debug(`Exploring unexplored node for region prefix ${regionPrefix} (exploration rate: ${explorationRate})`);
            return this.selectRandomNode(unexploredNodes);
        }

        // No affinity data at all and no unexplored nodes - return null to fallback
        if (nodeAffinityMap.size === 0 && unexploredNodes.length === 0) return null;

        // If we have no affinity data but have unexplored nodes, pick one to start building data
        if (nodeAffinityMap.size === 0) {
            logger.debug(`No affinity data for region prefix ${regionPrefix}, selecting unexplored node to build data`);
            return this.selectRandomNode(unexploredNodes);
        }

        const candidateNodes = this.collectCandidateNodes(nodeAffinityMap);
        const selectedNodes = this.selectNodesWithinThreshold(candidateNodes);

        return this.selectBestNodeFromCandidates(selectedNodes);
    }

    /**
     * Finds nodes that have no affinity data for any region prefix yet.
     * These are candidates for exploration to build up affinity data.
     * @param targetNodeIds - Node IDs that serve the target region
     * @param nodeAffinityMap - Map of nodes with existing affinity data
     * @returns Array of ready nodes without affinity data
     */
    private findUnexploredNodes(
        targetNodeIds: string[],
        nodeAffinityMap: Map<string, { node: QuaverNode; minPing: number }>
    ): QuaverNode[] {
        const unexplored: QuaverNode[] = [];

        for (const nodeId of targetNodeIds) {
            // Skip if we already have affinity data for this node
            if (nodeAffinityMap.has(nodeId)) continue;

            const node = this.nodes.get(nodeId);
            if (node && this.isNodeReady(node)) {
                unexplored.push(node);
            }
        }

        return unexplored;
    }

    /**
     * Finds nodes that have no affinity data for a specific region prefix.
     * These are candidates for exploration to build up affinity data.
     * @param allNodeIds - All available node IDs
     * @param regionPrefix - The region prefix to check for
     * @returns Array of ready nodes without affinity data for this region prefix
     */
    private findUnexploredNodesForRegionPrefix(
        allNodeIds: string[],
        regionPrefix: string
    ): QuaverNode[] {
        const unexplored: QuaverNode[] = [];

        for (const nodeId of allNodeIds) {
            const node = this.nodes.get(nodeId);
            if (!node || !this.isNodeReady(node)) continue;

            // Check if this node has any affinity data for this region prefix
            const hasData = Array.from(this.affinityCache.values()).some(
                (data) => data.nodeId === nodeId && data.regionPrefix === regionPrefix
            );

            if (!hasData) {
                unexplored.push(node);
            }
        }

        return unexplored;
    }

    /**
     * Selects a random node from the given array.
     * @param nodes - Array of nodes to choose from
     * @returns A randomly selected node, or null if array is empty
     */
    private selectRandomNode(nodes: QuaverNode[]): QuaverNode | null {
        if (nodes.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * nodes.length);
        return nodes[randomIndex] ?? null;
    }

    /**
     * Builds a map of nodes with their minimum ping for the target region.
     * Tracks minimum ping across all region prefixes to avoid skewing from fallback usage.
     */
    private buildNodeAffinityMap(targetNodeIds: string[]): Map<string, { node: QuaverNode; minPing: number }> {
        const nodeAffinityMap = new Map<string, { node: QuaverNode; minPing: number }>();

        for (const affinityData of this.affinityCache.values()) {
            const { nodeId, avgPing } = affinityData;

            if (!targetNodeIds.includes(nodeId)) continue;

            const node = this.nodes.get(nodeId);
            if (!node || !this.isNodeReady(node)) continue;

            const existing = nodeAffinityMap.get(nodeId);
            if (existing) {
                existing.minPing = Math.min(existing.minPing, avgPing);
            } else {
                nodeAffinityMap.set(nodeId, { node, minPing: avgPing });
            }
        }

        return nodeAffinityMap;
    }

    /**
     * Converts the node affinity map to an array of candidate nodes with their ping data.
     */
    private collectCandidateNodes(
        nodeAffinityMap: Map<string, { node: QuaverNode; minPing: number }>
    ): Array<{ node: QuaverNode; nodeId: string; minPing: number }> {
        const candidates: Array<{ node: QuaverNode; nodeId: string; minPing: number }> = [];

        for (const [nodeId, { node, minPing }] of nodeAffinityMap.entries()) {
            candidates.push({ node, nodeId, minPing });
        }

        return candidates;
    }

    /**
     * Filters candidates by ping threshold, or returns all if none meet the threshold.
     */
    private selectNodesWithinThreshold(
        candidateNodes: Array<{ node: QuaverNode; nodeId: string; minPing: number }>
    ): Array<{ node: QuaverNode; nodeId: string; minPing: number }> {
        const maxPingMs = settings.regionAffinity?.maxPingMs ?? 50;
        const suitableNodes = candidateNodes.filter(({ minPing }): boolean => minPing <= maxPingMs);

        return suitableNodes.length > 0 ? suitableNodes : candidateNodes;
    }

    /**
     * Selects the best node from candidates by finding the lowest ping.
     * Uses penalty-based selection as a tiebreaker if multiple nodes have the same ping.
     */
    private selectBestNodeFromCandidates(
        selectedNodes: Array<{ node: QuaverNode; nodeId: string; minPing: number }>
    ): QuaverNode | null {
        const lowestPing = Math.min(...selectedNodes.map(({ minPing }): number => minPing));
        const bestNodes = selectedNodes.filter(({ minPing }): boolean => minPing === lowestPing);

        if (bestNodes.length > 1) {
            const nodeArray = bestNodes.map(({ node }): QuaverNode => node);
            return Penalties.findBestNode(nodeArray);
        }

        return bestNodes[0]?.node ?? null;
    }

    /**
     * Check if a node is ready (WebSocket connected)
     */
    private isNodeReady(node: QuaverNode): boolean {
        // Access the ws.state from the node with optional chaining
        // LavalinkWSClientState.Ready = 2
        return node.ws?.state === 2;
    }

    /**
     * Get the best available node using penalty-based load balancing.
     * Considers CPU load, player count, and frame statistics to select optimal node.
     */
    private getNextAvailableNode(): QuaverNode | undefined {
        const nodeArray = Array.from(this.nodes.values());
        if (nodeArray.length === 0) return undefined;

        // Collect all ready nodes
        const readyNodes: QuaverNode[] = [];
        for (const node of nodeArray) {
            if (this.isNodeReady(node)) {
                readyNodes.push(node);
            }
        }

        // Use penalty-based selection to find the best node
        if (readyNodes.length > 0) {
            return Penalties.findBestNode(readyNodes);
        }

        // No ready nodes found, return undefined
        return undefined;
    }

    /**
     * Check if any node is ready
     */
    get ready(): boolean {
        for (const node of this.nodes.values()) {
            if (this.isNodeReady(node)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get the first ready node's WebSocket client (for compatibility)
     */
    get ws(): QuaverNode['ws'] | undefined {
        for (const node of this.nodes.values()) {
            if (this.isNodeReady(node)) {
                return node.ws;
            }
        }
        // Return first node's ws even if not ready
        return Array.from(this.nodes.values())[0]?.ws;
    }

    /**
     * Get the first ready node's REST client (for compatibility)
     */
    get rest(): QuaverNode['rest'] | undefined {
        for (const node of this.nodes.values()) {
            if (this.isNodeReady(node)) {
                return node.rest;
            }
        }
        // Return first node's rest even if not ready
        return Array.from(this.nodes.values())[0]?.rest;
    }

    /**
     * Get the first ready node's API client (for compatibility)
     */
    get api(): QuaverNode['api'] | undefined {
        for (const node of this.nodes.values()) {
            if (this.isNodeReady(node)) {
                return node.api;
            }
        }
        // Return first node's api even if not ready
        return Array.from(this.nodes.values())[0]?.api;
    }

    /**
     * Connect all nodes
     */
    connect(options?: { userId?: string; force?: boolean }): void {
        for (const node of this.nodes.values()) {
            node.connect(options);
        }
    }

    /**
     * Disconnect all nodes and clean up resources
     */
    disconnect(): void {
        // Clear pruning interval
        if (this.pruneInterval) {
            clearInterval(this.pruneInterval);
            this.pruneInterval = undefined;
        }

        for (const node of this.nodes.values()) {
            node.disconnect();
        }
    }
}
