import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import type { LocaleKey } from '#src/lib/locales';
import { logger } from '#src/lib/logger';
import { searchState } from '#src/lib/state';
import {
    buildMessageOptions,
    Check,
    getTrackMarkdownLocaleString,
    type QuaverChannels,
    type QuaverSong,
} from '#src/lib/util';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    type APIActionRowComponent,
    type APIButtonComponent,
    type APISelectMenuOption,
    type APIStringSelectComponent,
    ButtonBuilder,
    ContainerBuilder,
    ContainerComponent,
    type GuildMember,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
} from 'discord.js';

export default new ButtonHandler()
    .setChecks([Check.InteractionStarter])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const state = searchState[interaction.message.id];
        if (!state) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { components: [], force: ForceType.Update },
            );
            return;
        }
        const target = interaction.customId.split(':')[1];
        if (target === 'add') {
            const tracks = state.selected;
            const compatible = await guild.checkPlayerCompatibility({
                member: interaction.member as GuildMember,
                textChannel: interaction.channel,
                runChecks: true,
                replyHandler: interaction.replyHandler,
            });
            if (!compatible) return;
            clearTimeout(state.timeout);
            await interaction.replyHandler.reply(guild.locale('MISC.LOADING'), {
                components: [],
                force: ForceType.Update,
            });
            const resolvedTracks = [];
            for (const track of tracks) {
                const result =
                    await interaction.client.music.api.loadTracks(track);
                if (result.loadType === 'track') {
                    const data: QuaverSong = result.data;
                    data.requesterId = interaction.user.id;
                    data.id = crypto.randomUUID();
                    resolvedTracks.push(result.data);
                }
            }
            if (resolvedTracks.length === 0) {
                await interaction.replyHandler.reply(
                    guild.locale('CMD.SEARCH.RESPONSE.LOAD_FAILED'),
                    {
                        type: MessageOptionsBuilderType.Error,
                        components: [],
                    },
                );
                return;
            }
            let msg: LocaleKey,
                extras = [];
            if (resolvedTracks.length === 1) {
                msg = 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
                extras = [getTrackMarkdownLocaleString(resolvedTracks[0])];
            } else {
                msg = 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
                extras = [
                    resolvedTracks.length.toString(),
                    guild.locale('MISC.YOUR_SEARCH'),
                ];
            }
            const player = await guild.getPlayer({
                textChannel: interaction.channel as QuaverChannels,
                voiceChannelId: (interaction.member as GuildMember).voice
                    .channelId,
                replyHandler: interaction.replyHandler,
            });
            if (!player) return;
            const position = await player.addTracksToQueue(
                resolvedTracks,
                interaction.user.id,
            );
            await interaction.replyHandler.reply(
                new ContainerBuilder().addTextDisplayComponents(
                    guild.builders.textDisplayLocale(msg, ...extras),
                    ...(position !== '0'
                        ? [
                              new TextDisplayBuilder().setContent(
                                  `-# ${guild.locale(
                                      'MISC.POSITION',
                                  )}: ${position}`,
                              ),
                          ]
                        : []),
                ),
                { type: MessageOptionsBuilderType.Success, components: [] },
            );
            guild.sendWebUpdate(
                'queueUpdate',
                player.queue.tracks.map((track: QuaverSong): QuaverSong => {
                    const user = interaction.client.users.cache.get(
                        track.requesterId,
                    );
                    track.requesterTag = user?.tag;
                    track.requesterAvatar = user?.avatar;
                    return track;
                }),
            );
            delete searchState[interaction.message.id];
            return;
        }
        const page = parseInt(target);
        clearTimeout(state.timeout);
        state.timeout = setTimeout(
            async (g, message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            g.locale('DISCORD.INTERACTION.EXPIRED'),
                            { components: [] },
                        ),
                    );
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error(`${error.message}\n${error.stack}`);
                    }
                }
                delete searchState[message.id];
            },
            30_000,
            guild,
            interaction.message,
        );
        const pages = state.pages;
        const firstIndex = 10 * (page - 1) + 1;
        const pageSize = pages[page - 1].length;
        const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            return;
        }
        const container = new ContainerBuilder(
            interaction.message.components[0].toJSON(),
        );
        if (!(container.components[0] instanceof TextDisplayBuilder)) {
            return;
        }
        container.components[0] = new TextDisplayBuilder().setContent(
            pages[page - 1]
                .map((track: Song, index): string => {
                    const duration = msToTime(track.info.length);
                    let durationString = track.info.isStream
                        ? '∞'
                        : msToTimeString(duration, true);
                    if (durationString === 'MORE_THAN_A_DAY') {
                        durationString = guild.locale('MISC.MORE_THAN_A_DAY');
                    }
                    return `\`${(firstIndex + index)
                        .toString()
                        .padStart(
                            largestIndexSize,
                            ' ',
                        )}.\` **${getTrackMarkdownLocaleString(
                        track,
                    )}** \`[${durationString}]\``;
                })
                .join('\n'),
        );
        if (!(container.components[1] instanceof TextDisplayBuilder)) return;
        container.components[1] = guild.builders.textDisplayLocale(
            'MISC.PAGE',
            page.toString(),
            pages.length.toString(),
        );
        const selectMenuActionRow =
            ActionRowBuilder.from<StringSelectMenuBuilder>(
                container.components[3].toJSON() as APIActionRowComponent<APIStringSelectComponent>,
            );
        const selectMenuOptions = pages[page - 1]
            .map((track, index: number): APISelectMenuOption => {
                let label = `${firstIndex + index}. ${track.info.title}`;
                if (label.length >= 100) {
                    label = `${label.substring(0, 97)}...`;
                }
                return {
                    label: label,
                    description: track.info.author,
                    value: track.info.uri,
                    default: !!state.selected.find(
                        (uri: string): boolean => uri === track.info.uri,
                    ),
                };
            })
            .concat(
                state.selected
                    .map((uri: string): APISelectMenuOption => {
                        const refPg = pages.indexOf(
                            pages.find(
                                (pg): Song =>
                                    pg.find((t): boolean => t.info.uri === uri),
                            ),
                        );
                        const firstIdx = 10 * refPg + 1;
                        const refTrack = pages[refPg].find(
                            (t): boolean => t.info.uri === uri,
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
                            value: uri,
                            default: true,
                        };
                    })
                    .filter(
                        (options): boolean =>
                            !pages[page - 1].find(
                                (track): boolean =>
                                    track.info.uri === options.value,
                            ),
                    ),
            )
            .sort(
                (a, b): number =>
                    parseInt(a.label.split('.')[0]) -
                    parseInt(b.label.split('.')[0]),
            );
        selectMenuActionRow.components[0] = StringSelectMenuBuilder.from(
            selectMenuActionRow.components[0].toJSON(),
        )
            .setOptions(selectMenuOptions)
            .setMaxValues(selectMenuOptions.length);
        container.components[3] = selectMenuActionRow;
        const buttonActionRow = ActionRowBuilder.from<ButtonBuilder>(
            container.components[4].toJSON() as APIActionRowComponent<APIButtonComponent>,
        );
        buttonActionRow.components[0] = ButtonBuilder.from(
            buttonActionRow.components[0].toJSON(),
        )
            .setCustomId(`search:${page - 1}`)
            .setDisabled(page - 1 < 1);
        buttonActionRow.components[1] = ButtonBuilder.from(
            buttonActionRow.components[1].toJSON(),
        )
            .setCustomId(`search:${page + 1}`)
            .setDisabled(page + 1 > pages.length);
        container.components[4] = buttonActionRow;
        await interaction.replyHandler.reply(container, {
            force: ForceType.Update,
        });
    });
