import type { Guild } from 'discord.js';
import {
    type FetchOptions,
    type Identifiable,
    NodePlayerManager,
} from 'lavaclient';
import { type QuaverNode, QuaverPlayer } from '.';

export class QuaverPlayerManager<
    TNode extends QuaverNode = QuaverNode,
> extends NodePlayerManager<TNode> {
    cache: Map<string, QuaverPlayer<TNode>> = new Map();

    resolve(guild: Identifiable): QuaverPlayer<TNode> | undefined {
        return super.resolve(guild) as QuaverPlayer<TNode> | undefined;
    }

    create(guild: Guild): QuaverPlayer<TNode> {
        if (this.has(guild.id)) {
            return this.resolve(guild.id)!;
        }
        const guildId = guild.id;
        const player = new QuaverPlayer(this.node, guild);
        this.cache.set(guildId, player);
        return player;
    }

    fetch(cache?: boolean): Promise<QuaverPlayer<TNode>[]>;
    fetch(
        guild: Identifiable,
        options?: FetchOptions,
    ): Promise<QuaverPlayer<TNode>>;
    async fetch(
        cacheOrGuild?: boolean | Identifiable,
        options?: FetchOptions,
    ): Promise<QuaverPlayer<TNode>[] | QuaverPlayer<TNode>> {
        if (typeof cacheOrGuild === 'boolean') {
            const response = (await this.node.ws.session?.players()) ?? [];
            return response.map((data): QuaverPlayer<TNode> => {
                const guild = this.node.client.guilds.cache.get(data.guildId);
                if (!guild) {
                    throw new Error(`Guild ${data.guildId} not found`);
                }
                const player = cacheOrGuild
                    ? this.create(guild)
                    : new QuaverPlayer(this.node, guild);
                return player.patch(data);
            });
        }
        const guildId =
            typeof cacheOrGuild === 'string' ? cacheOrGuild : cacheOrGuild.id;
        let player = this.cache.get(guildId);
        if (!options?.force && player) {
            return player;
        }
        const data = await this.node.ws.session?.player(guildId)?.fetchOrNull();
        if (data) {
            const guild = this.node.client.guilds.cache.get(guildId);
            if (!guild) {
                throw new Error(`Guild ${guildId} not found`);
            }
            player = options?.cache
                ? (player ?? this.create(guild))
                : new QuaverPlayer(this.node, guild);
            return player.patch(data);
        }
        return undefined;
    }
}
