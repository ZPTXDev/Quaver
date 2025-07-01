import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import {
    confirmationTimeout,
    data,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, getLocaleString } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    InteractionCallbackResponse,
    Message,
    SeparatorBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
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
        const player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        if (player.queue.tracks.length === 0) {
            const response = await player.handler.disconnect();
            switch (response) {
                case PlayerResponse.FeatureConflict:
                    await interaction.replyHandler.locale(
                        'CMD.DISCONNECT.RESPONSE.FEATURE_247_ENABLED',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                case PlayerResponse.Success:
                    await interaction.replyHandler.locale(
                        'CMD.DISCONNECT.RESPONSE.SUCCESS',
                        { type: MessageOptionsBuilderType.Success },
                    );
                    return;
            }
        }
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        const response = await interaction.replyHandler.reply(
            new ContainerBuilder({
                components: [
                    new TextDisplayBuilder()
                        .setContent(
                            getLocaleString(
                                guildLocaleCode,
                                'CMD.DISCONNECT.RESPONSE.CONFIRMATION',
                            ),
                        )
                        .toJSON(),
                    new TextDisplayBuilder()
                        .setContent(
                            getLocaleString(
                                guildLocaleCode,
                                'MISC.ACTION_IRREVERSIBLE',
                            ),
                        )
                        .toJSON(),
                    new SeparatorBuilder().toJSON(),
                    new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('disconnect')
                                .setStyle(ButtonStyle.Danger)
                                .setLabel(
                                    getLocaleString(
                                        guildLocaleCode,
                                        'MISC.CONFIRM',
                                    ),
                                ),
                            new ButtonBuilder()
                                .setCustomId('cancel')
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel(
                                    getLocaleString(
                                        guildLocaleCode,
                                        'MISC.CANCEL',
                                    ),
                                ),
                        )
                        .toJSON(),
                ],
            }),
            {
                type: MessageOptionsBuilderType.Warning,
                withResponse: true,
            },
        );
        if (
            !(
                response instanceof InteractionCallbackResponse ||
                response instanceof Message
            )
        ) {
            return;
        }
        const msg =
            response instanceof InteractionCallbackResponse
                ? response.resource.message
                : response;
        confirmationTimeout[msg.id] = setTimeout(
            async (glc, message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            getLocaleString(glc, 'DISCORD.INTERACTION.EXPIRED'),
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
            10_000,
            guildLocaleCode,
            msg,
        );
    },
};
