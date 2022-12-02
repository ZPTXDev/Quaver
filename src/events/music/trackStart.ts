import type { QuaverQueue, QuaverSong } from '#src/lib/util/common.d.js';
import { data, logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    getGuildLocaleString,
    getLocaleString,
    msToTime,
    msToTimeString,
} from '#src/lib/util/util.js';
import { LyricsFinder } from '@jeve/lyrics-finder';
import type { APIEmbedField } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    escapeMarkdown,
} from 'discord.js';

export default {
    name: 'trackStart',
    once: false,
    async execute(queue: QuaverQueue, track: QuaverSong): Promise<void> {
        const { bot, io } = await import('#src/main.js');
        delete queue.player.skip;
        logger.info({
            message: `[G ${queue.player.guildId}] Starting track`,
            label: 'Quaver',
        });
        await queue.player.pause(false);
        if (settings.features.web.enabled) {
            io.to(`guild:${queue.player.guildId}`).emit(
                'pauseUpdate',
                queue.player.paused,
            );
        }
        if (queue.player.timeout) {
            clearTimeout(queue.player.timeout);
            delete queue.player.timeout;
            if (settings.features.web.enabled) {
                io.to(`guild:${queue.player.guildId}`).emit(
                    'timeoutUpdate',
                    !!queue.player.timeout,
                );
            }
        }
        const duration = msToTime(track.length);
        const durationString = track.isStream
            ? '∞'
            : msToTimeString(duration, true);
        if (settings.features.web.enabled) {
            io.to(`guild:${queue.player.guildId}`).emit(
                'queueUpdate',
                queue.tracks.map((t: QuaverSong): QuaverSong => {
                    t.requesterTag = bot.users.cache.get(t.requester)?.tag;
                    return t;
                }),
            );
        }
        const guildLocaleCode =
            (await data.guild.get<string>(
                queue.player.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        const format =
            (await data.guild.get(queue.player.guildId, 'settings.format')) ??
            'simple';
        format === 'simple'
            ? await queue.player.handler.send(
                  `${getLocaleString(
                      guildLocaleCode,
                      'MUSIC.PLAYER.PLAYING.NOW.SIMPLE',
                      escapeMarkdown(track.title),
                      track.uri,
                      durationString,
                  )}\n${getLocaleString(
                      guildLocaleCode,
                      'MISC.ADDED_BY',
                      track.requester,
                  )}`,
                  {
                      components:
                          settings.features.web.enabled &&
                          settings.features.web.dashboardURL
                              ? [
                                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                                        new ButtonBuilder()
                                            .setURL(
                                                `${settings.features.web.dashboardURL.replace(
                                                    /\/+$/,
                                                    '',
                                                )}/guild/${
                                                    queue.player.guildId
                                                }`,
                                            )
                                            .setStyle(ButtonStyle.Link)
                                            .setLabel(
                                                getLocaleString(
                                                    guildLocaleCode,
                                                    'MISC.DASHBOARD',
                                                ),
                                            ),
                                    ),
                                ]
                              : [],
                  },
              )
            : await queue.player.handler.send(
                  new EmbedBuilder()
                      .setTitle(
                          getLocaleString(
                              guildLocaleCode,
                              'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE',
                          ),
                      )
                      .setDescription(
                          `**[${escapeMarkdown(track.title)}](${track.uri})**`,
                      )
                      .addFields([
                          {
                              name: getLocaleString(
                                  guildLocaleCode,
                                  'MUSIC.PLAYER.PLAYING.NOW.DETAILED.DURATION',
                              ),
                              value: `\`${durationString}\``,
                              inline: true,
                          },
                          {
                              name: getLocaleString(
                                  guildLocaleCode,
                                  'MUSIC.PLAYER.PLAYING.NOW.DETAILED.UPLOADER',
                              ),
                              value: track.author,
                              inline: true,
                          },
                          {
                              name: getLocaleString(
                                  guildLocaleCode,
                                  'MUSIC.PLAYER.PLAYING.NOW.DETAILED.ADDED_BY',
                              ),
                              value: `<@${track.requester}>`,
                              inline: true,
                          },
                      ])
                      .setThumbnail(
                          `https://i.ytimg.com/vi/${track.identifier}/hqdefault.jpg`,
                      )
                      .setFooter({
                          text: getLocaleString(
                              guildLocaleCode,
                              'MUSIC.PLAYER.PLAYING.NOW.DETAILED.REMAINING',
                              queue.tracks.length.toString(),
                          ),
                      }),
                  {
                      components: settings.features.web.dashboardURL
                          ? [
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    new ButtonBuilder()
                                        .setURL(
                                            `${settings.features.web.dashboardURL.replace(
                                                /\/+$/,
                                                '',
                                            )}/guild/${queue.player.guildId}`,
                                        )
                                        .setStyle(ButtonStyle.Link)
                                        .setLabel(
                                            getLocaleString(
                                                guildLocaleCode,
                                                'MISC.DASHBOARD',
                                            ),
                                        ),
                                ),
                            ]
                          : [],
                  },
              );
        if (settings.features.autolyrics.enabled) {
            if (
                !(await data.guild.get<boolean>(
                    queue.player.guildId,
                    'settings.autolyrics',
                ))
            ) {
                return;
            }
            let lyrics: string | Error;
            try {
                lyrics = await LyricsFinder(track.title);
            } catch (error) {
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
            let lyricsFields: APIEmbedField[] = [];
            // try method 1
            let giveUp = false;
            if (lyrics.split('\n\n').length === 1) giveUp = true;
            lyrics
                .split('\n\n')
                .reduce((previous, chunk, index, array): string => {
                    if (giveUp) return;
                    if (chunk.length > 1024) giveUp = true;
                    if (previous.length + chunk.length > 1024) {
                        lyricsFields.push({
                            name: lyricsFields.length === 0 ? track.title : '​',
                            value: previous,
                        });
                        return chunk;
                    }
                    if (index === array.length - 1) {
                        lyricsFields.push({
                            name: lyricsFields.length === 0 ? track.title : '​',
                            value: previous + '\n\n' + chunk,
                        });
                    }
                    return previous + '\n\n' + chunk;
                });
            if (giveUp) {
                lyricsFields = [];
                // try method 2
                lyrics
                    .split('\n')
                    .reduce((previous, line, index, array): string => {
                        if (previous.length + line.length > 1024) {
                            lyricsFields.push({
                                name:
                                    lyricsFields.length === 0
                                        ? track.title
                                        : '​',
                                value: previous,
                            });
                            return line;
                        }
                        if (index === array.length - 1) {
                            lyricsFields.push({
                                name:
                                    lyricsFields.length === 0
                                        ? track.title
                                        : '​',
                                value: previous + '\n' + line,
                            });
                        }
                        return previous + '\n' + line;
                    }, '');
            }
            if (
                lyricsFields.reduce(
                    (previous, current): number =>
                        previous + current.value.length,
                    0,
                ) > 6000
            ) {
                let exceedIndex = -1;
                lyricsFields.reduce((previous, current, index): number => {
                    if (exceedIndex !== -1) return;
                    if (previous + current.value.length > 6000) {
                        exceedIndex = index;
                    }
                    return previous + current.value.length;
                }, 0);
                lyricsFields = lyricsFields.slice(0, exceedIndex);
                lyricsFields.push({ name: '​', value: '`...`' });
            }
            if (lyricsFields.length === 0) {
                return;
            }
            await queue.player.handler.send(
                new EmbedBuilder().setFields(lyricsFields),
                {
                    components: romanizeFrom
                        ? [
                              new ActionRowBuilder<ButtonBuilder>().addComponents(
                                  new ButtonBuilder()
                                      .setCustomId(`lyrics:${romanizeFrom}`)
                                      .setStyle(ButtonStyle.Secondary)
                                      .setLabel(
                                          await getGuildLocaleString(
                                              queue.player.guildId,
                                              `CMD.LYRICS.MISC.ROMANIZE_FROM_${romanizeFrom.toUpperCase()}`,
                                          ),
                                      ),
                              ),
                          ]
                        : [],
                },
            );
        }
    },
};
