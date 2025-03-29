import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import {
    confirmationTimeout,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
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
        .setName('clear')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.CLEAR.DESCRIPTION',
            ),
        ),
    checks: [
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const player = await interaction.client.music.players.fetch(
            interaction.guildId,
        );
        if (player.queue.tracks.length === 0) {
            await interaction.replyHandler.locale(
                'CMD.CLEAR.RESPONSE.QUEUE_EMPTY',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const msg = await interaction.replyHandler.reply(
            new EmbedBuilder()
                .setDescription(
                    await getGuildLocaleString(
                        interaction.guildId,
                        'CMD.CLEAR.RESPONSE.CONFIRMATION',
                    ),
                )
                .setFooter({
                    text: await getGuildLocaleString(
                        interaction.guildId,
                        'MISC.ACTION_IRREVERSIBLE',
                    ),
                }),
            {
                type: MessageOptionsBuilderType.Warning,
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('clear')
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
                withResponse: true,
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
