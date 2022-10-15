import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    buildMessageOptions,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Message,
    SlashCommandBuilder,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('disconnect')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.DISCONNECT.DESCRIPTION',
            ),
        ),
    checks: [
        checks.GUILD_ONLY,
        checks.ACTIVE_SESSION,
        checks.IN_VOICE,
        checks.IN_SESSION_VOICE,
    ],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        if (
            await data.guild.get(interaction.guildId, 'settings.stay.enabled')
        ) {
            await interaction.replyHandler.locale(
                'CMD.DISCONNECT.RESPONSE.FEATURE_247_ENABLED',
                { type: 'error' },
            );
            return;
        }
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        if (player.queue.tracks.length === 0) {
            await player.handler.disconnect();
            await interaction.replyHandler.locale(
                'CMD.DISCONNECT.RESPONSE.SUCCESS',
                { type: 'success' },
            );
            return;
        }
        const msg = await interaction.replyHandler.reply(
            new EmbedBuilder()
                .setDescription(
                    await getGuildLocaleString(
                        interaction.guildId,
                        'CMD.DISCONNECT.RESPONSE.CONFIRMATION',
                    ),
                )
                .setFooter({
                    text: await getGuildLocaleString(
                        interaction.guildId,
                        'MISC.ACTION_IRREVERSIBLE',
                    ),
                }),
            {
                type: 'warning',
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('disconnect')
                            .setStyle(ButtonStyle.Danger)
                            .setLabel(
                                await getGuildLocaleString(
                                    interaction.guildId,
                                    'MISC.CONFIRM',
                                ),
                            ),
                        new ButtonBuilder()
                            .setCustomId('cancel')
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel(
                                await getGuildLocaleString(
                                    interaction.guildId,
                                    'MISC.CANCEL',
                                ),
                            ),
                    ),
                ],
                fetchReply: true,
            },
        );
        if (!(msg instanceof Message)) return;
        confirmationTimeout[msg.id] = setTimeout(
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
                delete confirmationTimeout[message.id];
            },
            5 * 1000,
            msg,
        );
    },
};
