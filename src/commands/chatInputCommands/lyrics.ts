import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    formatResponse,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandStringOption,
} from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
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
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const query = interaction.options.getString('query');
        let json;
        let lyrics: string | Error;
        await interaction.deferReply();
        const player = interaction.guildId
            ? await interaction.client.music.players.fetch(interaction.guildId)
            : null;
        if (!query) {
            if (
                !interaction.guildId ||
                !player?.queue.current ||
                (!player?.playing && !player?.paused)
            ) {
                await interaction.replyHandler.locale(
                    'CMD.LYRICS.RESPONSE.NO_QUERY',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            try {
                const response = await interaction.client.music.rest.execute({
                    path: `/v4/sessions/${player.api.session.id}/players/${interaction.guildId}/lyrics`,
                    method: 'GET',
                });
                json = await response.json();
                lyrics = formatResponse(json, player);
            } catch {
                await interaction.replyHandler.locale(
                    'CMD.LYRICS.RESPONSE.NO_RESULTS',
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
                await interaction.replyHandler.locale(
                    'CMD.LYRICS.RESPONSE.NO_RESULTS',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
        }
        if (lyrics instanceof Error) {
            await interaction.replyHandler.locale(
                'CMD.LYRICS.RESPONSE.NO_RESULTS',
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
        const title = `**${json.track.override ?? `${json.track.author} - ${json.track.title}`}**`;
        lyrics =
            lyrics.length > 4000 - title.length
                ? `${lyrics.slice(0, 3999 - title.length)}…`
                : lyrics;
        if (lyrics.length === 0) {
            await interaction.replyHandler.locale(
                'CMD.LYRICS.RESPONSE.NO_RESULTS',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.replyHandler.reply(
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
                                          .setCustomId(`lyrics:${romanizeFrom}`)
                                          .setStyle(ButtonStyle.Secondary)
                                          .setLabel(
                                              await getGuildLocaleString(
                                                  interaction.guildId,
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
    },
};
