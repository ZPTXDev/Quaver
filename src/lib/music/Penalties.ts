import type { QuaverNode } from './QuaverNode';

/**
 * Node statistics interface (from Lavalink stats event)
 */
interface NodeStats {
    players: number;
    playingPlayers: number;
    uptime: number;
    memory: {
        free: number;
        used: number;
        allocated: number;
        reservable: number;
    };
    cpu: {
        cores: number;
        systemLoad: number;
        lavalinkLoad: number;
    };
    frameStats?: {
        sent: number;
        nulled: number;
        deficit: number;
    };
}

export interface PenaltyProvider {
    /**
     * Calculates the penalty count for the given node.
     */
    calculate: (node: QuaverNode) => number;
}

/**
 * Penalty calculation courtesy of:
 * https://github.com/duncte123/lavalink-client/blob/main/src/main/kotlin/dev/arbjerg/lavalink/internal/loadbalancing/Penalties.kt
 * 
 * Calculates load penalties for Lavalink nodes to enable intelligent load balancing.
 * Lower penalty = better node for new players.
 */
export const Penalties = {
    /**
     * Calculate the total penalty for a node based on various metrics.
     * 
     * @param node - The QuaverNode to calculate penalties for
     * @returns Total penalty score (lower is better)
     */
    calculate(node: QuaverNode): number {
        // Access stats via type assertion since it's not in the type definitions
        // but exists at runtime when the node receives stats from Lavalink
        const stats = (node as { stats?: NodeStats }).stats;
        
        if (!stats) {
            // No stats available yet, return high penalty
            return Number.MAX_SAFE_INTEGER;
        }

        let penalty = 0;

        // CPU penalty
        penalty += this.calculateCpuPenalty(stats.cpu);

        // Player penalty (each player adds to the load)
        penalty += stats.players;

        // Null frame penalty (frames that couldn't be provided)
        if (stats.frameStats?.nulled) {
            penalty += stats.frameStats.nulled * 2;
        }

        // Deficit frame penalty (frames that were late)
        if (stats.frameStats?.deficit) {
            penalty += stats.frameStats.deficit * 1.5;
        }

        return penalty;
    },

    /**
     * Calculate CPU penalty based on system load and Lavalink process load.
     * 
     * @param cpu - CPU stats from node
     * @returns CPU penalty value
     */
    calculateCpuPenalty(cpu: { systemLoad: number; lavalinkLoad: number }): number {
        const systemLoad = cpu.systemLoad;
        const lavalinkLoad = cpu.lavalinkLoad;

        // If system load exceeds 50%, apply exponential penalty
        let cpuPenalty = 0;
        if (systemLoad > 0.5) {
            // Exponential penalty as system load increases
            cpuPenalty += Math.pow(1.05, 100 * systemLoad) * 10 - 10;
        }

        // Lavalink process load contributes more heavily
        // If Lavalink itself is loaded, that's more directly impactful
        if (lavalinkLoad > 0.5) {
            cpuPenalty += Math.pow(1.05, 100 * lavalinkLoad) * 10 - 10;
        }

        // Give Lavalink load higher weight
        cpuPenalty += lavalinkLoad * 11 - 10;

        return cpuPenalty;
    },

    /**
     * Find the node with the lowest penalty from the provided list.
     * 
     * @param nodes - Array of QuaverNodes to evaluate
     * @returns The node with the lowest penalty, or undefined if empty
     */
    findBestNode(nodes: QuaverNode[]): QuaverNode | undefined {
        if (nodes.length === 0) return undefined;
        if (nodes.length === 1) return nodes[0];

        let bestNode: QuaverNode | undefined;
        let lowestPenalty = Number.MAX_SAFE_INTEGER;

        for (const node of nodes) {
            const penalty = this.calculate(node);
            if (penalty < lowestPenalty) {
                lowestPenalty = penalty;
                bestNode = node;
            }
        }

        return bestNode;
    },
};
