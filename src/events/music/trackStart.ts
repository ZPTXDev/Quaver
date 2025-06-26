import type { QuaverQueue, QuaverSong } from '#src/lib/util/common.d.js';
import { data, logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    formatResponse,
    getGuildFeatureWhitelisted,
    getGuildLocaleString,
    getLocaleString,
    getTrackMarkdownLocaleString,
    WhitelistStatus,
} from '#src/lib/util/util.js';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from 'discord.js';

export default {
    name: 'trackStart',
    once: false,
    async execute(queue: QuaverQueue, track: QuaverSong): Promise<void> {
        const { bot, io } = await import('#src/main.js');
        delete queue.player.skip;
        logger.info({
            message: `[G ${queue.player.id}] Starting track`,
            label: 'Quaver',
        });
        await queue.player.pause(false);
        if (settings.features.web.enabled) {
            io.to(`guild:${queue.player.id}`).emit(
                'pauseUpdate',
                queue.player.paused,
            );
        }
        if (queue.player.timeout) {
            clearTimeout(queue.player.timeout);
            delete queue.player.timeout;
            if (settings.features.web.enabled) {
                io.to(`guild:${queue.player.id}`).emit(
                    'timeoutUpdate',
                    !!queue.player.timeout,
                );
            }
        }
        const duration = msToTime(track.info.length);
        let durationString = track.info.isStream
            ? '∞'
            : msToTimeString(duration, true);
        if (durationString === 'MORE_THAN_A_DAY') {
            durationString = await getGuildLocaleString(
                queue.player.id,
                'MISC.MORE_THAN_A_DAY',
            );
        }
        if (settings.features.web.enabled) {
            io.to(`guild:${queue.player.id}`).emit(
                'queueUpdate',
                queue.tracks.map((t: QuaverSong): QuaverSong => {
                    const user = bot.users.cache.get(t.requesterId);
                    t.requesterTag = user?.tag;
                    t.requesterAvatar = user?.avatar;
                    return t;
                }),
            );
        }
        let notify =
            (await data.guild.get<boolean>(
                queue.player.id,
                'settings.notifyin247',
            )) ?? true;
        notify = !(
            !notify &&
            (await data.guild.get(queue.player.id, 'settings.stay.enabled'))
        );
        const guildLocaleCode =
            (await data.guild.get<string>(
                queue.player.id,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        let format =
            (await data.guild.get(queue.player.id, 'settings.format')) ??
            'simple';
        if (!notify) format = 'off';
        const emoji =
            settings.emojis?.[
                track.info.sourceName as keyof typeof settings.emojis
            ] ?? '';
        switch (format) {
            case 'simple':
                await queue.player.handler.send(
                    new ContainerBuilder({
                        components: [
                            new TextDisplayBuilder()
                                .setContent(
                                    `${getLocaleString(
                                        guildLocaleCode,
                                        'MUSIC.PLAYER.PLAYING.NOW.SIMPLE.TEXT',
                                        getTrackMarkdownLocaleString(track),
                                        durationString,
                                    )}\n${getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.SIMPLE.SOURCE')}: ${emoji ? `${emoji} ` : ''}**${getLocaleString(guildLocaleCode, `MISC.SOURCES.${track.info.sourceName.toUpperCase()}`)}** ─ ${getLocaleString(
                                        guildLocaleCode,
                                        'MISC.ADDED_BY',
                                        track.requesterId,
                                    )}`,
                                )
                                .toJSON(),
                            ...(settings.features.web.enabled &&
                            settings.features.web.dashboardURL
                                ? [
                                      new SeparatorBuilder().toJSON(),
                                      new ActionRowBuilder<ButtonBuilder>()
                                          .addComponents(
                                              new ButtonBuilder()
                                                  .setURL(
                                                      `${settings.features.web.dashboardURL.replace(
                                                          /\/+$/,
                                                          '',
                                                      )}/guild/${queue.player.id}`,
                                                  )
                                                  .setStyle(ButtonStyle.Link)
                                                  .setLabel(
                                                      getLocaleString(
                                                          guildLocaleCode,
                                                          'MISC.DASHBOARD',
                                                      ),
                                                  ),
                                          )
                                          .toJSON(),
                                  ]
                                : []),
                        ],
                    }),
                );
                break;
            case 'detailed':
                await queue.player.handler.send(
                    new ContainerBuilder({
                        components: [
                            new SectionBuilder({
                                components: [
                                    new TextDisplayBuilder()
                                        .setContent(
                                            getLocaleString(
                                                guildLocaleCode,
                                                'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE',
                                            ),
                                        )
                                        .toJSON(),
                                    new TextDisplayBuilder()
                                        .setContent(
                                            `${getLocaleString(
                                                guildLocaleCode,
                                                'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TEXT',
                                                `[${track.info.author} - ${track.info.title}](${track.info.uri})`,
                                                durationString,
                                            )}\n${getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.SOURCE')}: ${emoji ? `${emoji} ` : ''}**${getLocaleString(guildLocaleCode, `MISC.SOURCES.${track.info.sourceName.toUpperCase()}`)}** ─ ${getLocaleString(
                                                guildLocaleCode,
                                                'MISC.ADDED_BY',
                                                track.requesterId,
                                            )}`,
                                        )
                                        .toJSON(),
                                    new TextDisplayBuilder()
                                        .setContent(
                                            getLocaleString(
                                                guildLocaleCode,
                                                'MUSIC.PLAYER.PLAYING.NOW.DETAILED.REMAINING',
                                                queue.tracks.length.toString(),
                                            ),
                                        )
                                        .toJSON(),
                                ],
                                accessory: new ThumbnailBuilder()
                                    .setURL(
                                        `https://i.ytimg.com/vi/${track.info.identifier}/hqdefault.jpg`,
                                    )
                                    .toJSON(),
                            }).toJSON(),
                            ...(settings.features.web.dashboardURL
                                ? [
                                      new SeparatorBuilder().toJSON(),
                                      new ActionRowBuilder<ButtonBuilder>()
                                          .addComponents(
                                              new ButtonBuilder()
                                                  .setURL(
                                                      `${settings.features.web.dashboardURL.replace(
                                                          /\/+$/,
                                                          '',
                                                      )}/guild/${queue.player.id}`,
                                                  )
                                                  .setStyle(ButtonStyle.Link)
                                                  .setLabel(
                                                      getLocaleString(
                                                          guildLocaleCode,
                                                          'MISC.DASHBOARD',
                                                      ),
                                                  ),
                                          )
                                          .toJSON(),
                                  ]
                                : []),
                        ],
                    }),
                );
        }
        if (settings.features.autolyrics.enabled) {
            if (
                !(await data.guild.get<boolean>(
                    queue.player.id,
                    'settings.autolyrics',
                ))
            ) {
                return;
            }
            const whitelisted = await getGuildFeatureWhitelisted(
                queue.player.id,
                'autolyrics',
            );
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                return;
            }
            let json;
            let lyrics: string | Error;
            try {
                const response = await bot.music.rest.execute({
                    path: `/v4/sessions/${queue.player.api.session.id}/players/${queue.player.id}/lyrics`,
                    method: 'GET',
                });
                json = await response.json();
                lyrics = formatResponse(json, queue.player);
            } catch {
                return;
            }
            if (lyrics instanceof Error) {
                return;
            }
            let romanizeFrom = '';
            // use regex to check if lyrics have any korean characters
            if (
                lyrics.match(
                    /[\uac00-\ud7af]|[\u1100-\u11ff]|[\u3130-\u318f]|[\ua960-\ua97f]|[\ud7b0-\ud7ff]/g,
                )
            ) {
                romanizeFrom = 'korean';
            } else if (lyrics.match(/[\u3040-\u309f]|[\u30a0-\u30ff]/g)) {
                romanizeFrom = 'japanese';
            } else if (lyrics.match(/[\u4e00-\u9fff]/g)) {
                romanizeFrom = 'chinese';
            }
            const title = `**${json.track.override ?? `${json.track.author} - ${json.track.title}`}**`;
            lyrics =
                lyrics.length > 4000 - title.length
                    ? `${lyrics.slice(0, 3999 - title.length)}…`
                    : lyrics;
            if (lyrics.length === 0) return;
            await queue.player.handler.send(
                new ContainerBuilder({
                    components: [
                        new TextDisplayBuilder().setContent(title).toJSON(),
                        new TextDisplayBuilder().setContent(lyrics).toJSON(),
                        ...(romanizeFrom
                            ? [
                                  new SeparatorBuilder().toJSON(),
                                  new ActionRowBuilder<ButtonBuilder>()
                                      .addComponents(
                                          new ButtonBuilder()
                                              .setCustomId(
                                                  `lyrics:${romanizeFrom}`,
                                              )
                                              .setStyle(ButtonStyle.Secondary)
                                              .setLabel(
                                                  await getGuildLocaleString(
                                                      queue.player.id,
                                                      `CMD.LYRICS.MISC.ROMANIZE_FROM_${romanizeFrom.toUpperCase()}`,
                                                  ),
                                              ),
                                      )
                                      .toJSON(),
                              ]
                            : []),
                    ],
                }),
            );
        }
    },
};
