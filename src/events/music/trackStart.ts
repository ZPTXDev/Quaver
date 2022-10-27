import type { QuaverQueue, QuaverSong } from '#src/lib/util/common.d.js';
import { data, logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    getLocaleString,
    msToTime,
    msToTimeString,
} from '#src/lib/util/util.js';
import { EmbedBuilder, escapeMarkdown } from 'discord.js';

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
                      ),
              );
    },
};
