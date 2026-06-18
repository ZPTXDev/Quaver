import type { QuaverNode } from './QuaverNode';
import type { QuaverPlayer, QuaverPlayerJSON } from './QuaverPlayer';
import type { FetchOptions, PlayerManager } from 'lavaclient';
import type { VoiceServerUpdate, VoiceStateUpdate } from 'lavaclient/dist/playerVoice';
import type { Identifiable } from 'lavaclient/dist/tools';
import type { QuaverCluster } from './QuaverCluster';
import type { Guild } from 'discord.js';

/**
 * ClusterPlayerManager routes player operations to the appropriate QuaverNode
 * based on region affinity and load balancing.
 */
export class ClusterPlayerManager implements PlayerManager<QuaverNode> {
    readonly cluster: QuaverCluster;
    private guildNodeMap: Map<string, string> = new Map();

    constructor(cluster: QuaverCluster) {
        this.cluster = cluster;
    }

    /**
     * Get combined cache of all players across all nodes
     */
    get cache(): Map<string, QuaverPlayer<QuaverNode>> {
        const combined = new Map<string, QuaverPlayer<QuaverNode>>();
        for (const node of this.cluster.nodes.values()) {
            for (const [guildId, player] of node.players.cache) {
                combined.set(guildId, player as QuaverPlayer<QuaverNode>);
            }
        }
        return combined;
    }

    /**
     * Check if a player exists for the guild
     */
    has(guild: Identifiable): boolean {
        const guildId = typeof guild === 'string' ? guild : guild.id;
        return this.getNodeForGuild(guildId)?.players.has(guildId) ?? false;
    }

    /**
     * Resolve a player for the guild
     */
    resolve(guild: Identifiable): QuaverPlayer<QuaverNode> | undefined {
        const guildId = typeof guild === 'string' ? guild : guild.id;
        const node = this.getNodeForGuild(guildId);
        return node?.players.resolve(guildId) as QuaverPlayer<QuaverNode> | undefined;
    }

    /**
     * Get the node ID for a guild, verifying the player still exists
     */
    getNodeIdForGuild(guildId: string): string | null {
        const nodeId = this.guildNodeMap.get(guildId);
        if (nodeId) {
            // Verify player still exists
            const node = this.cluster.nodes.get(nodeId);
            if (node && node.players.has(guildId)) {
                return nodeId;
            }
            // Clean up stale entry
            this.guildNodeMap.delete(guildId);
        }

        // Fallback: search all nodes directly
        // This handles cases like restart or direct player creation
        for (const [id, node] of this.cluster.nodes.entries()) {
            if (node.players.has(guildId)) {
                // Update our tracking
                this.guildNodeMap.set(guildId, id);
                return id;
            }
        }

        return null;
    }

    /**
     * Fetch players from all nodes
     */
    fetch(cache?: boolean): Promise<QuaverPlayer<QuaverNode>[]>;
    fetch(guild: Identifiable, options?: FetchOptions): Promise<QuaverPlayer<QuaverNode> | undefined>;
    async fetch(
        guildOrCache?: Identifiable | boolean,
        options?: FetchOptions,
    ): Promise<QuaverPlayer<QuaverNode>[] | QuaverPlayer<QuaverNode> | undefined> {
        if (typeof guildOrCache === 'boolean' || guildOrCache === undefined) {
            // Fetch all players
            const allPlayers: QuaverPlayer<QuaverNode>[] = [];
            for (const node of this.cluster.nodes.values()) {
                const players = await node.players.fetch(guildOrCache as boolean | undefined);
                allPlayers.push(...(players as QuaverPlayer<QuaverNode>[]));
            }
            return allPlayers;
        }

        // Fetch specific guild's player
        const guildId = typeof guildOrCache === 'string' ? guildOrCache : guildOrCache.id;
        const node = this.getNodeForGuild(guildId);
        return (await node?.players.fetch(guildId, options)) as QuaverPlayer<QuaverNode> | undefined;
    }

    /**
     * Create a player on the best available node
     */
    create(guild: Guild): QuaverPlayer<QuaverNode> {
        const guildId = guild.id;
        
        // Check if player already exists
        const existing = this.resolve(guildId);
        if (existing) return existing;

        // Select best node based on voice region if available
        const voiceChannel = guild.members.me?.voice?.channel;
        const region = voiceChannel?.rtcRegion ?? null;
        const node = this.cluster.getNodeForRegion(region);
        if (!node) {
            throw new Error('No available Lavalink nodes');
        }

        // Create player on selected node
        const player = node.players.create(guild) as QuaverPlayer<QuaverNode>;
        
        // Track which node this guild is on
        const nodeId = Array.from(this.cluster.nodes.entries())
            .find(([, n]: [string, QuaverNode]): boolean => n === node)?.[0];
        if (nodeId) {
            this.guildNodeMap.set(guildId, nodeId);
        }

        return player;
    }

    /**
     * Create a player from JSON data (for restoration after restart)
     */
    async createFromJSON(
        guild: Guild,
        data: QuaverPlayerJSON,
        resumed = false,
    ): Promise<QuaverPlayer<QuaverNode>> {
        // Check if player already exists on a node
        let node = this.getNodeForGuild(guild.id);
        
        // If no existing node, select best node based on voice region
        if (!node) {
            const voiceChannel = guild.members.me?.voice?.channel;
            const region = voiceChannel?.rtcRegion ?? null;
            node = this.cluster.getNodeForRegion(region);
            if (!node) {
                throw new Error('No available Lavalink nodes');
            }
            
            // Track which node this guild is on
            const nodeId = Array.from(this.cluster.nodes.entries())
                .find(([, n]: [string, QuaverNode]): boolean => n === node)?.[0];
            if (nodeId) {
                this.guildNodeMap.set(guild.id, nodeId);
            }
        }
        
        // Delegate to the node's player manager
        return node.players.createFromJSON(guild, data, resumed) as Promise<QuaverPlayer<QuaverNode>>;
    }

    /**
     * Destroy player(s)
     */
    destroy(guild: Identifiable, force?: boolean): Promise<boolean>;
    destroy(): Promise<number>;
    async destroy(guild?: Identifiable, force?: boolean): Promise<boolean | number> {
        if (!guild) {
            // Destroy all players
            let count = 0;
            for (const node of this.cluster.nodes.values()) {
                count += await node.players.destroy();
            }
            this.guildNodeMap.clear();
            return count;
        }

        const guildId = typeof guild === 'string' ? guild : guild.id;
        const node = this.getNodeForGuild(guildId);
        const result = await node?.players.destroy(guildId, force) ?? false;
        
        if (result) {
            this.guildNodeMap.delete(guildId);
        }
        
        return result;
    }

    /**
     * Handle voice updates (route to appropriate node)
     */
    async handleVoiceUpdate(update: VoiceStateUpdate | VoiceServerUpdate): Promise<boolean> {
        const guildId = update.guild_id;
        const node = this.getNodeForGuild(guildId);
        
        if (!node) {
            // If no node assigned yet, this might be the first voice update
            // Just return false, player will be created later
            return false;
        }

        return node.players.handleVoiceUpdate(update);
    }

    /**
     * Get the node that a guild's player is on
     */
    private getNodeForGuild(guildId: string): QuaverNode | undefined {
        const nodeId = this.guildNodeMap.get(guildId);
        if (nodeId) {
            return this.cluster.nodes.get(nodeId);
        }

        // Check if player exists on any node
        for (const [id, node] of this.cluster.nodes) {
            if (node.players.has(guildId)) {
                this.guildNodeMap.set(guildId, id);
                return node;
            }
        }

        return undefined;
    }
}
