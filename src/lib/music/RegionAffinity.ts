import KeyvSqlite from '@keyv/sqlite';
import Keyv from 'keyv';

interface AffinityData {
    regionPrefix: string;
    avgPing: number;
    lastUpdated: number;
}

/**
 * Manages ping-based region affinity data for Lavalink nodes.
 * Uses Keyv with SQLite backend for persistence.
 */
export class RegionAffinity {
    private keyv: Keyv;

    /**
     * Creates a new RegionAffinity instance.
     * @param databaseUri - The SQLite database URI (e.g., 'sqlite://path/to/db.sqlite')
     */
    constructor(databaseUri: string) {
        this.keyv = new Keyv({
            store: new KeyvSqlite({
                uri: databaseUri,
            }),
            namespace: 'region-affinity',
        });
    }

    /**
     * Updates or creates affinity data for a node using exponential moving average.
     * @param nodeId - The unique identifier for the Lavalink node
     * @param regionPrefix - The region prefix (e.g., 'c-sin', 'c-use')
     * @param ping - The current ping measurement in milliseconds
     */
    async upsertAffinity(nodeId: string, regionPrefix: string, ping: number): Promise<void> {
        // Use compound key: nodeId:regionPrefix to track affinity per node per region
        const key = `${nodeId}:${regionPrefix}`;
        const existing = await this.keyv.get<AffinityData>(key);
        
        let avgPing: number;
        if (existing) {
            // Calculate exponential moving average (EMA) with α = 0.5
            avgPing = existing.avgPing * 0.5 + ping * 0.5;
        } else {
            // First measurement
            avgPing = ping;
        }

        const data: AffinityData = {
            regionPrefix,
            avgPing,
            lastUpdated: Date.now(),
        };

        await this.keyv.set(key, data);
    }

    /**
     * Gets all non-stale affinity data entries.
     * @param staleAfterMs - Time in milliseconds after which data is considered stale
     * @returns Array of entries with nodeId, regionPrefix, and affinity data
     */
    async getAllNodes(staleAfterMs: number): Promise<Array<{nodeId: string, regionPrefix: string, data: AffinityData}>> {
        const now = Date.now();
        const result: Array<{nodeId: string, regionPrefix: string, data: AffinityData}> = [];

        // Keyv doesn't have a native "get all keys" method, so we need to iterate
        // This is a limitation, but acceptable for a small number of nodes
        const iteratorFunc = this.keyv.iterator;
        if (!iteratorFunc) {
            // Iterator not available, return empty result
            return result;
        }

        const iterator = iteratorFunc();
        for await (const [key, data] of iterator) {
            const affinityData = data as AffinityData;
            
            // Skip stale entries
            if (now - affinityData.lastUpdated > staleAfterMs) {
                continue;
            }

            // Parse compound key: nodeId:regionPrefix
            // Since nodeId is now host:port format, we need to find the last colon
            const keyStr = key as string;
            const lastColonIndex = keyStr.lastIndexOf(':');
            if (lastColonIndex === -1) {
                // Skip malformed keys
                continue;
            }

            const nodeId = keyStr.substring(0, lastColonIndex);
            const regionPrefix = keyStr.substring(lastColonIndex + 1);

            result.push({
                nodeId,
                regionPrefix,
                data: affinityData,
            });
        }

        return result;
    }

    /**
     * Removes stale affinity entries from the database.
     * @param staleAfterMs - Time in milliseconds after which data is considered stale
     */
    async pruneStaleEntries(staleAfterMs: number): Promise<void> {
        const now = Date.now();
        const iteratorFunc = this.keyv.iterator;

        if (!iteratorFunc) {
            // Iterator not available, skip pruning
            return;
        }

        const iterator = iteratorFunc();
        const keysToDelete: string[] = [];
        
        for await (const [key, data] of iterator) {
            const affinityData = data as AffinityData;
            
            if (now - affinityData.lastUpdated > staleAfterMs) {
                keysToDelete.push(key as string);
            }
        }

        // Delete all stale keys
        for (const key of keysToDelete) {
            await this.keyv.delete(key);
        }
    }
}
