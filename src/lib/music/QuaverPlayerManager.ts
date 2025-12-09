import type { QuaverChannels } from '#src/lib/util';
import type { Guild } from 'discord.js';
import {
    type FetchOptions,
    type Identifiable,
    NodePlayerManager,
} from 'lavaclient';
import { type QuaverNode, QuaverPlayer, type QuaverPlayerJSON } from '.';

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

    async createFromJSON(
        guild: Guild,
        data: QuaverPlayerJSON,
    ): Promise<QuaverPlayer<TNode>> {
        if (data.version !== 1) {
            throw new Error(
                `Unsupported QuaverPlayerJSON version: ${data.version}`,
            );
        }
        const player = this.create(guild);
        const channel = await guild.channels.fetch(data.textChannelId);
        player.queue.channel = channel as QuaverChannels;
        player.queue.current = data.queue.current ?? null;
        player.queue.tracks = [...data.queue.tracks];
        player.queue.setLoop(data.loop);
        player.memory.shuffle = data.memory.shuffle;
        player.memory.alternate = data.memory.alternate;
        player.memory.originalQueue = data.memory.originalQueue
            ? [...data.memory.originalQueue]
            : undefined;
        player.memory.shuffledQueue = data.memory.shuffledQueue
            ? [...data.memory.shuffledQueue]
            : undefined;
        player.memory.failureCount = data.memory.failureCount;
        player.memory.skip = data.memory.skip
            ? {
                  required: data.memory.skip.required,
                  users: [...data.memory.skip.users],
              }
            : undefined;
        if (data.effects.bassboost !== player.memory.bassboost) {
            await player.setBassboost(data.effects.bassboost);
        }
        if (data.effects.nightcore !== player.memory.nightcore) {
            await player.setNightcore(data.effects.nightcore);
        }
        await player.setVolumeTo(data.volume);
        if (data.paused && !player.paused) {
            await player.setPause(true);
        }
        if (player.memory.shuffle || player.memory.alternate) {
            player.recomputeQueue();
        }
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
