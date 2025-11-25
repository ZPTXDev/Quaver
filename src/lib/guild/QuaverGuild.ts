import type { QuaverClient, ReplyHandler } from '#src/lib';
import { MessageOptionsBuilderType } from '#src/lib';
import { getLocaleString, type LocaleKey } from '#src/lib/locales';
import type { QuaverNode, QuaverPlayer } from '#src/lib/music';
import type { QuaverChannels } from '#src/lib/util';
import { settings } from '#src/lib/util';
import type { Guild, Snowflake } from 'discord.js';
import { GuildBuilders, GuildFeatures, GuildSettings } from '.';

type PlayerCreationData = {
    textChannel: QuaverChannels;
    voiceChannelId: Snowflake;
    replyHandler?: ReplyHandler;
};

export type Initialized = { localeCode: string };
export type Uninitialized = { localeCode: undefined };

export class QuaverGuild<S extends Uninitialized | Initialized> {
    builders!: GuildBuilders;
    features!: GuildFeatures;
    settings!: GuildSettings;
    localeCode: S['localeCode'];
    client: QuaverClient;

    private constructor(private guild: Guild) {
        this.localeCode = undefined as S['localeCode'];
        this.client = guild.client as QuaverClient;
    }

    private async init(): Promise<void> {
        this.settings = new GuildSettings(this.guild);
        this.localeCode =
            (await this.settings.get<string>('locale')) ??
            settings.defaultLocaleCode;
        this.builders = new GuildBuilders(this);
        this.features = new GuildFeatures(this.guild);
    }

    sendWebUpdate(event: string, ...args: unknown[]): void {
        if (!settings.features.web.enabled) return;
        this.client.io.to(`guild:${this.guild.id}`).emit(event, ...args);
    }

    async getPlayer(
        options?: PlayerCreationData,
    ): Promise<QuaverPlayer<QuaverNode> | undefined> {
        let player = await this.client.music.players.fetch(this.guild.id);
        if (
            player?.voice.connected ||
            !options.textChannel ||
            !options.voiceChannelId
        )
            return player;
        player = this.client.music.players.create(this.guild);
        player.queue.channel = options.textChannel;
        player.voice.connect(options.voiceChannelId, {
            deafened: true,
        });
        // Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
        // Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
        // Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
        const me = await this.guild?.members.fetchMe();
        const timedOut = me.isCommunicationDisabled();
        if (!this.guild) {
            await player.disconnect();
            if (options.replyHandler) {
                await options.replyHandler.reply(
                    this.locale('DISCORD.GENERIC_ERROR'),
                    { type: MessageOptionsBuilderType.Error },
                );
            }
            return;
        }
        if (timedOut) {
            if (options.replyHandler) {
                await options.replyHandler.reply(
                    this.locale(
                        'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT',
                    ),
                    { type: MessageOptionsBuilderType.Error },
                );
            }
            return;
        }
        if (!options.voiceChannelId) {
            if (options.replyHandler) {
                await options.replyHandler.reply(
                    this.locale('DISCORD.INTERACTION.CANCELED'),
                );
            }
            return;
        }
        const smartQueue = await this.settings.get<boolean>('smartqueue');
        if (smartQueue) {
            await player.setAlternate(true);
        }
        return player;
    }

    locale(
        this: QuaverGuild<Initialized>,
        key: LocaleKey,
        ...args: string[]
    ): string {
        return getLocaleString(this.localeCode, key, ...args);
    }

    static async wrap(guild: Guild): Promise<QuaverGuild<Initialized> & Guild> {
        if (!guild) {
            throw new Error(
                'Guild is required and cannot be null or undefined',
            );
        }
        const instance = new QuaverGuild(guild);
        await instance.init();
        return new Proxy(instance as QuaverGuild<Initialized>, {
            get(target, prop, receiver): unknown {
                if (prop in target) return Reflect.get(target, prop, receiver);
                return Reflect.get(guild, prop, receiver);
            },
        }) as QuaverGuild<Initialized> & Guild;
    }
}
