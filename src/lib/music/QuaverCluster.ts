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
    private affinityCache: Map<string, { regionPrefix: string; avgPing: number; lastUpdated: number }> = new Map();

    constructor(options: QuaverClusterOptions, client: QuaverClient, regionAffinity: RegionAffinity | null = null) {
        super();
        this.client = client;
        this.nodes = new Map();
        this.regionMap = new Map();
        this.regionAffinity = regionAffinity;

        // Create QuaverNode instances for each configured node
        options.nodes.forEach((nodeConfig, index): void => {
            const nodeId = `node-${index}`;
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

            // Build region mapping: region -> [nodeId1, nodeId2, ...]
            const nodeIds = this.regionMap.get(nodeConfig.region) || [];
            nodeIds.push(nodeId);
            this.regionMap.set(nodeConfig.region, nodeIds);
        });

        // Create cluster player manager that routes operations across nodes
        this.players = new ClusterPlayerManager(this);

        // Set up periodic pruning and cache refresh for affinity data if enabled
        if (this.regionAffinity && settings.regionAffinity?.enabled) {
            const staleAfterMs = settings.regionAffinity.staleAfterMs ?? 300000;
            const refreshSeconds = settings.regionAffinity.refreshSeconds ?? 30;
            
            // Initial cache refresh
            void this.refreshAffinityCache();

            this.pruneInterval = setInterval((): void => {
                // Prune stale entries
                this.regionAffinity?.pruneStaleEntries(staleAfterMs).catch((err): void => {
                    logger.error({ message: 'Failed to prune stale affinity entries', label: 'QuaverCluster', error: err });
                });
                
                // Refresh cache
                void this.refreshAffinityCache();
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
            
            // Clear old cache
            this.affinityCache.clear();
            
            // Populate cache
            for (const { nodeId, data } of allNodes) {
                this.affinityCache.set(nodeId, data);
            }
            
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
        // Try affinity-based selection first if enabled
        if (this.regionAffinity && settings.regionAffinity?.enabled) {
            const affinityNode = this.selectNodeByAffinity();
            if (affinityNode) {
                // Find the node ID for logging
                const nodeId = Array.from(this.nodes.entries())
                    .find(([, n]: [string, QuaverNode]): boolean => n === affinityNode)?.[0] ?? 'unknown';
                logger.debug(`Selected node by affinity: ${nodeId}`);
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
     * Returns null if affinity data is unavailable or all nodes are not ready.
     */
    private selectNodeByAffinity(): QuaverNode | null {
        if (!this.regionAffinity || this.affinityCache.size === 0) return null;

        const maxPingMs = settings.regionAffinity?.maxPingMs ?? 50;

        // Collect ready nodes with affinity data
        const candidateNodes: Array<{ node: QuaverNode; nodeId: string; avgPing: number }> = [];
        
        for (const [nodeId, affinityData] of this.affinityCache.entries()) {
            const node = this.nodes.get(nodeId);
            if (node && this.isNodeReady(node)) {
                candidateNodes.push({
                    node,
                    nodeId,
                    avgPing: affinityData.avgPing,
                });
            }
        }

        if (candidateNodes.length === 0) return null;

        // Try to find nodes that meet the threshold
        const suitableNodes = candidateNodes.filter(({ avgPing }): boolean => avgPing <= maxPingMs);
        
        let selectedNodes: typeof candidateNodes;
        if (suitableNodes.length > 0) {
            // Use nodes that meet the threshold
            selectedNodes = suitableNodes;
        } else {
            // No nodes meet threshold, use all candidates (will pick lowest ping)
            selectedNodes = candidateNodes;
        }

        // Find the lowest ping
        const lowestPing = Math.min(...selectedNodes.map(({ avgPing }): number => avgPing));
        
        // Get all nodes with the lowest ping
        const bestNodes = selectedNodes.filter(({ avgPing }): boolean => avgPing === lowestPing);

        // If multiple nodes have the same ping, use penalty-based selection as tiebreaker
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
        // Access the ws.state from the node
        // LavalinkWSClientState.Ready = 2
        return node.ws.state === 2;
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

        // No ready nodes found, return first node anyway
        return nodeArray[0];
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
    connect(): void {
        for (const node of this.nodes.values()) {
            node.connect();
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
