import { MessageOptionsBuilderType } from '#src/lib';
import { QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import type { LocaleKey } from '#src/lib/locales';
import { logger } from '#src/lib/logger';
import { updateHandler } from '#src/lib/state';
import {
    formatLavaLyricsResponse,
    getTrackMarkdownLocaleString,
    type LavaLyricsResponse,
    type QuaverQueue,
    type QuaverSong,
    settings,
} from '#src/lib/util';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    type ButtonBuilder,
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
        const guild = await QuaverGuild.wrap(queue.player.guild);
        delete queue.player.memory.skip;
        logger.info(`[G ${guild.id}] Starting track`);
        if (queue.player.memory.alternate) {
            const whitelisted =
                await guild.features.checkWhitelisted('smartqueue');
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                await queue.player.setAlternate(false);
            }
        }
        const transformsActive =
            queue.player.memory.shuffle || queue.player.memory.alternate;
        if (transformsActive) {
            // Remove this track from the canonical originalQueue snapshot
            if (queue.player.memory.originalQueue) {
                const base = queue.player.memory.originalQueue;
                const idx = base.findIndex(
                    (s: QuaverSong): boolean => s.id === track.id,
                );
                if (idx !== -1) base.splice(idx, 1);
            }
            // And from the stable shuffled order, if present
            if (queue.player.memory.shuffledQueue) {
                const i = queue.player.memory.shuffledQueue.indexOf(track.id);
                if (i !== -1) queue.player.memory.shuffledQueue.splice(i, 1);
            }
            // Recompute the transformed queue (shuffle + alternate) for the
            // upcoming tracks, taking the new current into account.
            queue.player.recomputeQueue();
        }
        await queue.player.pause(false);
        guild.sendWebUpdate('pauseUpdate', queue.player.paused);
        if (queue.player.timeout.standard) {
            clearTimeout(queue.player.timeout.standard);
            delete queue.player.timeout.standard;
            guild.sendWebUpdate(
                'timeoutUpdate',
                !!queue.player.timeout.standard,
            );
        }
        const duration = msToTime(track.info.length);
        let durationString = track.info.isStream
            ? '∞'
            : msToTimeString(duration, true);
        if (durationString === 'MORE_THAN_A_DAY') {
            durationString = guild.locale('MISC.MORE_THAN_A_DAY');
        }
        guild.sendWebUpdate('queueUpdate', queue.player.decorateQueue());
        if (
            updateHandler.restartInProgress &&
            updateHandler.restartStrategy === 'track'
        ) {
            await queue.player.setPause(true);
            await queue.player.sendMessage(
                new ContainerBuilder().addTextDisplayComponents(
                    guild.builders.textDisplayLocale(
                        'MUSIC.PLAYER.RESTARTING.PENDING',
                    ),
                    guild.builders.textDisplayLocale(
                        'MUSIC.PLAYER.RESTARTING.SESSION_RECOVERY_EXPLANATION',
                    ),
                    guild.builders.textDisplayLocale(
                        'MUSIC.PLAYER.RESTARTING.APOLOGY',
                    ),
                ),
                { type: MessageOptionsBuilderType.Warning },
            );
            return;
        }
        let notify = (await guild.settings.get<boolean>('notifyin247')) ?? true;
        notify = !(
            !notify && (await guild.settings.get<boolean>('stay.enabled'))
        );
        let format = (await guild.settings.get<string>('format')) ?? 'simple';
        if (!notify) format = 'off';
        const emoji =
            settings.emojis?.[
                track.info.sourceName as keyof typeof settings.emojis
            ] ?? '';
        switch (format) {
            case 'simple':
                await queue.player.sendMessage(
                    new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${guild.locale(
                                    'MUSIC.PLAYER.PLAYING.NOW.SIMPLE.TEXT',
                                    getTrackMarkdownLocaleString(track),
                                    durationString,
                                )}\n${guild.locale('MUSIC.PLAYER.PLAYING.NOW.SIMPLE.SOURCE')}: ${emoji ? `${emoji} ` : ''}**${guild.locale(`MISC.SOURCES.${track.info.sourceName.toUpperCase()}` as LocaleKey)}** ─ ${guild.locale(
                                    'MISC.ADDED_BY',
                                    track.requesterId,
                                )}`,
                            ),
                        )
                        .addSeparatorComponents(
                            ...(settings.features.web.enabled &&
                            settings.features.web.dashboardURL
                                ? [new SeparatorBuilder()]
                                : []),
                        )
                        .addActionRowComponents(
                            ...(settings.features.web.enabled &&
                            settings.features.web.dashboardURL
                                ? [
                                      new ActionRowBuilder<ButtonBuilder>().addComponents(
                                          guild.builders
                                              .buttonLocale('MISC.DASHBOARD')
                                              .setStyle(ButtonStyle.Link)
                                              .setURL(
                                                  `${settings.features.web.dashboardURL.replace(
                                                      /\/+$/,
                                                      '',
                                                  )}/guild/${guild.id}`,
                                              ),
                                      ),
                                  ]
                                : []),
                        ),
                );
                break;
            case 'detailed':
                await queue.player.sendMessage(
                    new ContainerBuilder()
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    guild.builders.textDisplayLocale(
                                        'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE',
                                    ),
                                    new TextDisplayBuilder().setContent(
                                        `${guild.locale(
                                            'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TEXT',
                                            `[${track.info.author} - ${track.info.title}](${track.info.uri})`,
                                            durationString,
                                        )}\n${guild.locale('MUSIC.PLAYER.PLAYING.NOW.DETAILED.SOURCE')}: ${emoji ? `${emoji} ` : ''}**${guild.locale(`MISC.SOURCES.${track.info.sourceName.toUpperCase()}` as LocaleKey)}** ─ ${guild.locale(
                                            'MISC.ADDED_BY',
                                            track.requesterId,
                                        )}`,
                                    ),
                                    guild.builders.textDisplayLocale(
                                        'MUSIC.PLAYER.PLAYING.NOW.DETAILED.REMAINING',
                                        queue.tracks.length.toString(),
                                    ),
                                )
                                .setThumbnailAccessory(
                                    new ThumbnailBuilder().setURL(
                                        track.info.artworkUrl ??
                                            `https://i.ytimg.com/vi/${track.info.identifier}/hqdefault.jpg`,
                                    ),
                                ),
                        )
                        .addSeparatorComponents(
                            ...(settings.features.web.dashboardURL
                                ? [new SeparatorBuilder()]
                                : []),
                        )
                        .addActionRowComponents(
                            new ActionRowBuilder<ButtonBuilder>().addComponents(
                                guild.builders
                                    .buttonLocale('MISC.DASHBOARD')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(
                                        `${settings.features.web.dashboardURL.replace(
                                            /\/+$/,
                                            '',
                                        )}/guild/${guild.id}`,
                                    ),
                            ),
                        ),
                );
        }
        if (settings.features.autolyrics.enabled) {
            if (!(await guild.settings.get<boolean>('autolyrics'))) {
                return;
            }
            const whitelisted =
                await guild.features.checkWhitelisted('autolyrics');
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                return;
            }
            let json;
            let lyrics: string | Error;
            try {
                const response = await queue.player.client.music.rest.execute({
                    path: `/v4/sessions/${queue.player.api.session.id}/players/${guild.id}/track/lyrics`,
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${settings.lavalink.password}`,
                    },
                });
                json = (await response.json()) as LavaLyricsResponse;
                lyrics = formatLavaLyricsResponse(json, queue.player);
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
            const title = `**${queue.current.info.author} - ${queue.current.info.title}**`;
            lyrics =
                lyrics.length > 4000 - title.length
                    ? `${lyrics.slice(0, 3999 - title.length)}…`
                    : lyrics;
            if (lyrics.length === 0) return;
            await queue.player.sendMessage(
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(title),
                        new TextDisplayBuilder().setContent(lyrics),
                    )
                    .addSeparatorComponents(
                        ...(romanizeFrom ? [new SeparatorBuilder()] : []),
                    )
                    .addActionRowComponents(
                        ...(romanizeFrom
                            ? [
                                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                                      guild.builders
                                          .buttonLocale(
                                              `CMD.LYRICS.MISC.ROMANIZE_FROM_${romanizeFrom.toUpperCase()}` as LocaleKey,
                                          )
                                          .setStyle(ButtonStyle.Secondary)
                                          .setCustomId(
                                              `lyrics:${romanizeFrom}`,
                                          ),
                                  ),
                              ]
                            : []),
                    ),
            );
        }
    },
};
