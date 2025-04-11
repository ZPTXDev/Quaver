import PlayerHandler from '#src/lib/PlayerHandler.js';
import { ForceType } from '#src/lib/ReplyHandler.js';
import type {
    QuaverChannels,
    QuaverInteraction,
    QuaverPlayer,
    QuaverSong,
} from '#src/lib/util/common.d.js';
import {
    data,
    logger,
    MessageOptionsBuilderType,
    searchState,
} from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    buildMessageOptions,
    getFailedChecks,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import type {
    APISelectMenuOption,
    ButtonComponent,
    ButtonInteraction,
    GuildMember,
    MessageActionRowComponentBuilder,
    StringSelectMenuComponent,
} from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ChannelType,
    EmbedBuilder,
    escapeMarkdown,
    PermissionsBitField,
    StringSelectMenuBuilder,
} from 'discord.js';

export default {
    name: 'search',
    checks: [Check.InteractionStarter],
    async execute(
        interaction: QuaverInteraction<ButtonInteraction>,
    ): Promise<void> {
        const state = searchState[interaction.message.id];
        if (!state) {
            await interaction.replyHandler.locale(
                'DISCORD.INTERACTION.EXPIRED',
                { components: [], force: ForceType.Update },
            );
            return;
        }
        const target = interaction.customId.split(':')[1];
        if (target === 'add') {
            const { bot, io } = await import('#src/main.js');
            const tracks = state.selected;
            let player = (await interaction.client.music.players.fetch(
                interaction.guildId,
            )) as QuaverPlayer;
            const member = interaction.member as GuildMember;
            const failedChecks: Check[] = await getFailedChecks(
                [Check.InVoice, Check.InSessionVoice],
                interaction.guildId,
                member,
            );
            if (failedChecks.length > 0) {
                await interaction.replyHandler.locale(failedChecks[0], {
                    type: MessageOptionsBuilderType.Error,
                });
                return;
            }
            // check for connect, speak permission for channel
            const permissions = member?.voice.channel.permissionsFor(
                interaction.client.user.id,
            );
            if (
                !permissions.has(
                    new PermissionsBitField([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.Connect,
                        PermissionsBitField.Flags.Speak,
                    ]),
                )
            ) {
                await interaction.replyHandler.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            if (
                member?.voice.channel.type === ChannelType.GuildStageVoice &&
                !permissions.has(PermissionsBitField.StageModerator)
            ) {
                await interaction.replyHandler.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            let me = await interaction.guild.members.fetchMe();
            if (me.isCommunicationDisabled()) {
                await interaction.replyHandler.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            clearTimeout(state.timeout);
            await interaction.replyHandler.locale('MISC.LOADING', {
                components: [],
                force: ForceType.Update,
            });
            const resolvedTracks = [];
            for (const track of tracks) {
                const result =
                    await interaction.client.music.api.loadTracks(track);
                if (result.loadType === 'track') {
                    resolvedTracks.push(result.data);
                }
            }
            let msg,
                extras = [];
            if (resolvedTracks.length === 1) {
                msg = 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
                extras = [
                    escapeMarkdown(resolvedTracks[0].info.title),
                    resolvedTracks[0].info.uri,
                ];
            } else {
                msg = 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
                extras = [
                    resolvedTracks.length.toString(),
                    await getGuildLocaleString(
                        interaction.guildId,
                        'MISC.YOUR_SEARCH',
                    ),
                    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                ];
            }
            if (!player?.voice.connected) {
                player = interaction.client.music.players.create(
                    interaction.guildId,
                ) as QuaverPlayer;
                player.handler = new PlayerHandler(interaction.client, player);
                player.queue.channel = interaction.channel as QuaverChannels;
                await player.voice.connect(member.voice.channelId, {
                    deafened: true,
                });
                // Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
                // Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
                // Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
                me = await interaction.guild.members.fetchMe();
                const timedOut = me.isCommunicationDisabled();
                if (!member.voice.channelId || timedOut || !interaction.guild) {
                    if (interaction.guild) {
                        if (timedOut) {
                            await interaction.replyHandler.locale(
                                'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT',
                                {
                                    type: MessageOptionsBuilderType.Error,
                                    components: [],
                                },
                            );
                        } else {
                            await interaction.replyHandler.locale(
                                'DISCORD.INTERACTION.CANCELED',
                                {
                                    vars: [interaction.user.id],
                                    components: [],
                                },
                            );
                        }
                    }
                    await player.handler.disconnect();
                    return;
                }
            }
            const firstPosition = player.queue.tracks.length + 1;
            const endPosition = firstPosition + resolvedTracks.length - 1;
            player.queue.add(resolvedTracks, {
                requester: interaction.user.id,
            });
            const started = player.playing || player.paused;
            const smartQueue = await data.guild.get<boolean>(
                interaction.guildId,
                'settings.smartqueue',
            );
            await interaction.replyHandler.reply(
                new EmbedBuilder()
                    .setDescription(
                        await getGuildLocaleString(
                            interaction.guildId,
                            msg,
                            ...extras,
                        ),
                    )
                    .setFooter({
                        text:
                            started && !smartQueue
                                ? `${await getGuildLocaleString(
                                      interaction.guildId,
                                      'MISC.POSITION',
                                  )}: ${firstPosition}${
                                      endPosition !== firstPosition
                                          ? ` - ${endPosition}`
                                          : ''
                                  }`
                                : null,
                    }),
                { type: MessageOptionsBuilderType.Success, components: [] },
            );
            if (!started) await player.queue.start();
            if (smartQueue) await player.handler.sort();
            if (settings.features.web.enabled) {
                io.to(`guild:${interaction.guildId}`).emit(
                    'queueUpdate',
                    player.queue.tracks.map((track: QuaverSong): QuaverSong => {
                        const user = bot.users.cache.get(track.requesterId);
                        track.requesterTag = user?.tag;
                        track.requesterAvatar = user?.avatar;
                        return track;
                    }),
                );
            }
            delete searchState[interaction.message.id];
            return;
        }
        const page = parseInt(target);
        clearTimeout(state.timeout);
        state.timeout = setTimeout(
            async (message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            new EmbedBuilder().setDescription(
                                await getGuildLocaleString(
                                    message.guildId,
                                    'DISCORD.INTERACTION.EXPIRED',
                                ),
                            ),
                            { components: [] },
                        ),
                    );
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error({
                            message: `${error.message}\n${error.stack}`,
                            label: 'Quaver',
                        });
                    }
                }
                delete searchState[message.id];
            },
            30 * 1000,
            interaction.message,
        );
        const pages = state.pages;
        const firstIndex = 10 * (page - 1) + 1;
        const pageSize = pages[page - 1].length;
        const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
        const original = {
            embeds: interaction.message.embeds,
            components: interaction.message.components,
        };
        if (original.embeds.length === 0) {
            await interaction.message.delete();
            return;
        }
        const updated: {
            embeds: EmbedBuilder[];
            components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
        } = { embeds: [], components: [] };
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        updated.embeds[0] = EmbedBuilder.from(original.embeds[0])
            .setDescription(
                pages[page - 1]
                    .map((track, index: number): string => {
                        const duration = msToTime(track.info.length);
                        let durationString = track.info.isStream
                            ? '∞'
                            : msToTimeString(duration, true);
                        if (durationString === 'MORE_THAN_A_DAY') {
                            durationString = getLocaleString(
                                guildLocaleCode,
                                'MISC.MORE_THAN_A_DAY',
                            );
                        }
                        return `\`${(firstIndex + index)
                            .toString()
                            .padStart(
                                largestIndexSize,
                                ' ',
                            )}.\` **[${escapeMarkdown(track.info.title)}](${
                            track.info.uri
                        })** \`[${durationString}]\``;
                    })
                    .join('\n'),
            )
            .setFooter({
                text: await getGuildLocaleString(
                    interaction.guildId,
                    'MISC.PAGE',
                    page.toString(),
                    pages.length.toString(),
                ),
            });
        updated.components[0] = ActionRowBuilder.from(original.components[0]);
        updated.components[1] = ActionRowBuilder.from(original.components[1]);
        const selectComponent = StringSelectMenuBuilder.from(
            original.components[0].components[0] as StringSelectMenuComponent,
        ).setOptions(
            pages[page - 1]
                .map((track, index: number): APISelectMenuOption => {
                    let label = `${firstIndex + index}. ${track.info.title}`;
                    if (label.length >= 100) {
                        label = `${label.substring(0, 97)}...`;
                    }
                    return {
                        label: label,
                        description: track.info.author,
                        value: track.info.identifier,
                        default: !!state.selected.find(
                            (identifier: string): boolean =>
                                identifier === track.info.identifier,
                        ),
                    };
                })
                .concat(
                    state.selected
                        .map((identifier: string): APISelectMenuOption => {
                            const refPg = pages.indexOf(
                                pages.find(
                                    (pg): Song =>
                                        pg.find(
                                            (t): boolean =>
                                                t.info.identifier ===
                                                identifier,
                                        ),
                                ),
                            );
                            const firstIdx = 10 * refPg + 1;
                            const refTrack = pages[refPg].find(
                                (t): boolean =>
                                    t.info.identifier === identifier,
                            );
                            let label = `${
                                firstIdx + pages[refPg].indexOf(refTrack)
                            }. ${refTrack.info.title}`;
                            if (label.length >= 100) {
                                label = `${label.substring(0, 97)}...`;
                            }
                            return {
                                label: label,
                                description: refTrack.info.author,
                                value: identifier,
                                default: true,
                            };
                        })
                        .filter(
                            (options): boolean =>
                                !pages[page - 1].find(
                                    (track): boolean =>
                                        track.info.identifier === options.value,
                                ),
                        ),
                )
                .sort(
                    (a, b): number =>
                        parseInt(a.label.split('.')[0]) -
                        parseInt(b.label.split('.')[0]),
                ),
        );
        // this code probably doesn't even do anything?
        selectComponent.setMaxValues(selectComponent.options.length);
        updated.components[0].components[0] = selectComponent;
        updated.components[1].components[0] = ButtonBuilder.from(
            original.components[1].components[0] as ButtonComponent,
        )
            .setCustomId(`search:${page - 1}`)
            .setDisabled(page - 1 < 1);
        updated.components[1].components[1] = ButtonBuilder.from(
            original.components[1].components[1] as ButtonComponent,
        )
            .setCustomId(`search:${page + 1}`)
            .setDisabled(page + 1 > pages.length);
        await interaction.replyHandler.reply(updated.embeds, {
            components: updated.components,
            force: ForceType.Update,
        });
    },
};
