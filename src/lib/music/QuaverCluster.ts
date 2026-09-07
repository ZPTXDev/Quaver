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
     */
    getNodeForRegion(region?: string | null): QuaverNode | undefined {
        // Try affinity-based selection first if enabled and region is specified
        if (region && this.regionAffinity && settings.regionAffinity?.enabled) {
            const affinityNode = this.selectNodeByAffinity(region);
            if (affinityNode) {
                // Find the node ID for logging
                let nodeId = 'unknown';
                for (const [id, node] of this.nodes.entries()) {
                    if (node === affinityNode) {
                        nodeId = id;
                        break;
                    }
                }
                logger.debug(`Selected node by affinity: ${nodeId} for region: ${region}`);
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
     * @param targetRegion - The Lavalink configured region to filter nodes by (e.g., "singapore")
     * @returns The best node for the target region, or null if no affinity data available
     */
    private selectNodeByAffinity(targetRegion: string | null): QuaverNode | null {
        if (!this.regionAffinity || this.affinityCache.size === 0 || !targetRegion) return null;

        const targetNodeIds = this.regionMap.get(targetRegion);
        if (!targetNodeIds || targetNodeIds.length === 0) return null;

        const nodeAffinityMap = this.buildNodeAffinityMap(targetNodeIds);
        if (nodeAffinityMap.size === 0) return null;

        const candidateNodes = this.collectCandidateNodes(nodeAffinityMap);
        const selectedNodes = this.selectNodesWithinThreshold(candidateNodes);

        return this.selectBestNodeFromCandidates(selectedNodes);
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
