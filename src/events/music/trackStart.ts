import type { QuaverQueue, QuaverSong } from '#src/lib/util/common.d.js';
import { data, logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    WhitelistStatus,
    generateEmbedFieldsFromLyrics,
    getGuildFeatureWhitelisted,
    getGuildLocaleString,
    getLocaleString, formatResponse,
} from '#src/lib/util/util.js';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
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
        const guildLocaleCode =
            (await data.guild.get<string>(
                queue.player.id,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        const format =
            (await data.guild.get(queue.player.id, 'settings.format')) ??
            'simple';
        format === 'simple'
            ? await queue.player.handler.send(
                  `${getLocaleString(
                      guildLocaleCode,
                      'MUSIC.PLAYER.PLAYING.NOW.SIMPLE',
                      escapeMarkdown(track.info.title),
                      track.info.uri,
                      durationString,
                  )}\n${getLocaleString(
                      guildLocaleCode,
                      'MISC.ADDED_BY',
                      track.requesterId,
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
                                                )}/guild/${queue.player.id}`,
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
                          `**[${escapeMarkdown(track.info.title)}](${track.info.uri})**`,
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
                              value: track.info.author,
                              inline: true,
                          },
                          {
                              name: getLocaleString(
                                  guildLocaleCode,
                                  'MUSIC.PLAYER.PLAYING.NOW.DETAILED.ADDED_BY',
                              ),
                              value: `<@${track.requesterId}>`,
                              inline: true,
                          },
                      ])
                      .setThumbnail(
                          `https://i.ytimg.com/vi/${track.info.identifier}/hqdefault.jpg`,
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
                                            )}/guild/${queue.player.id}`,
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
                const response = await bot.music.rest.execute({ path: `/v4/sessions/${queue.player.api.session.id}/players/${queue.player.id}/lyrics`, method: 'GET' });
                json = await response.json();
                lyrics = formatResponse(json, queue.player);
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
            const lyricsFields = generateEmbedFieldsFromLyrics(
                json,
                lyrics,
            );
            if (lyricsFields.length === 0) return;
            let embed;
            try {
                embed = new EmbedBuilder().setFields(lyricsFields);
            } catch (error) {
                return;
            }
            await queue.player.handler.send(
                embed,
                {
                    components: romanizeFrom
                        ? [
                              new ActionRowBuilder<ButtonBuilder>().addComponents(
                                  new ButtonBuilder()
                                      .setCustomId(`lyrics:${romanizeFrom}`)
                                      .setStyle(ButtonStyle.Secondary)
                                      .setLabel(
                                          await getGuildLocaleString(
                                              queue.player.id,
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
