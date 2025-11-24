import {
    ActionRowBuilder,
    type ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    SlashCommandBuilder,
    type SlashCommandStringOption,
    TextDisplayBuilder,
} from 'discord.js';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { MessageOptionsBuilderType } from '#src/lib/util/common';
import { settings } from '#src/lib/util/settings';
import { formatLavaLyricsResponse, formatResponse, getLocaleString } from '#src/lib/util/util';
import type { LavaLyricsResponse } from '#src/lib/util/util.d';
import type { LocaleKey } from '#src/lib/util/LocaleKeys';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('lyrics')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.LYRICS.DESCRIPTION',
                ),
            )
            .addStringOption(
                (option): SlashCommandStringOption =>
                    option
                        .setName('query')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.LYRICS.OPTION.QUERY',
                            ),
                        ),
            ),
    )
    .setExecute(async function(interaction): Promise<void> {
        const query = interaction.options.getString('query');
        const guild = await QuaverGuild.wrap(interaction.guild);
        let json;
        let lyrics: string | Error;
        await interaction.deferReply();
        const player = interaction.guildId ? await guild.getPlayer() : null;
        if (!query) {
            if (
                !interaction.guildId ||
                !player?.queue.current ||
                (!player?.playing && !player?.paused)
            ) {
                await interaction.replyHandler.reply(
                    guild.locale('CMD.LYRICS.RESPONSE.NO_QUERY'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            try {
                const response = await interaction.client.music.rest.execute({
                    path: `/v4/sessions/${player.api.session.id}/players/${interaction.guildId}/track/lyrics`,
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${settings.lavalink.password}`,
                    },
                });
                json = (await response.json()) as LavaLyricsResponse;
                lyrics = formatLavaLyricsResponse(json, player);
            } catch {
                await interaction.replyHandler.reply(
                    guild.locale('CMD.LYRICS.RESPONSE.NO_RESULTS'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
        } else {
            try {
                const response = await interaction.client.music.rest.execute({
                    path: `/v4/lyrics/search?query=${query}&source=genius`,
                    method: 'GET',
                });
                json = await response.json();
                lyrics = formatResponse(json);
            } catch {
                await interaction.replyHandler.reply(
                    guild.locale('CMD.LYRICS.RESPONSE.NO_RESULTS'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
        }
        if (lyrics instanceof Error) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.LYRICS.RESPONSE.NO_RESULTS'),
                { type: MessageOptionsBuilderType.Error },
            );
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
        const title = json.track
            ? `**${json.track.override ?? `${json.track.author} - ${json.track.title}`}**`
            : `**${player.queue.current.info.author} - ${player.queue.current.info.title}**`;
        lyrics =
            lyrics.length > 4000 - title.length
                ? `${lyrics.slice(0, 3999 - title.length)}…`
                : lyrics;
        if (lyrics.length === 0) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.LYRICS.RESPONSE.NO_RESULTS'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.replyHandler.reply(
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
                                          `lyrics:romanize:${romanizeFrom}`,
                                      ),
                              ),
                          ]
                        : []),
                ),
        );
    });
