import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandBooleanOption,
} from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.247.DESCRIPTION'),
        )
        .addBooleanOption(
            (option): SlashCommandBooleanOption =>
                option
                    .setName('enabled')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.247.OPTION.ENABLED',
                        ),
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
        const enabled = interaction.options.getBoolean('enabled');
        const player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        // if the user has provided a preference, its input boolean value is used as the guild's stay.enabled value
        // if the user simply used the slash command without using the enabled option, toggling it in a sense,
        // it defaults to opposite of the stay.enabled value stored from the the guild's data.
        const isGuildStayEnabled =
            enabled !== null
                ? enabled
                : !(await data.guild.get(
                      interaction.guildId,
                      'settings.stay.enabled',
                  ));
        const response = await player.handler.stay(isGuildStayEnabled);
        switch (response) {
            case PlayerResponse.FeatureDisabled:
                await interaction.replyHandler.locale(
                    'FEATURE.DISABLED.DEFAULT',
                    {
                        type: MessageOptionsBuilderType.Error,
                    },
                );
                return;
            case PlayerResponse.FeatureNotWhitelisted:
                if (settings.features.stay.premium && settings.premiumURL) {
                    await interaction.replyHandler.locale(
                        'FEATURE.NO_PERMISSION.PREMIUM',
                        {
                            type: MessageOptionsBuilderType.Error,
                            components: [
                                new ActionRowBuilder<ButtonBuilder>().setComponents(
                                    new ButtonBuilder()
                                        .setLabel(
                                            await getGuildLocaleString(
                                                interaction.guildId,
                                                'MISC.GET_PREMIUM',
                                            ),
                                        )
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(settings.premiumURL),
                                ),
                            ],
                        },
                    );
                    return;
                }
                await interaction.replyHandler.locale(
                    'FEATURE.NO_PERMISSION.DEFAULT',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.QueueChannelMissing: {
                const applicationCommands =
                    interaction.client.application?.commands;
                if (applicationCommands.cache.size === 0) {
                    await applicationCommands.fetch();
                }
                await interaction.replyHandler.locale(
                    'CMD.247.RESPONSE.QUEUE_CHANNEL_MISSING',
                    {
                        type: MessageOptionsBuilderType.Error,
                        vars: [
                            applicationCommands.cache.find(
                                (command): boolean => command.name === 'bind',
                            )?.id ?? '1',
                        ],
                    },
                );
                return;
            }
            case PlayerResponse.Success:
                // pause timeout is theoretically impossible because the user would need to be in the same vc as Quaver
                // and pause timeout is only set when everyone leaves
                await interaction.replyHandler.reply(
                    new EmbedBuilder()
                        .setDescription(
                            await getGuildLocaleString(
                                interaction.guildId,
                                isGuildStayEnabled
                                    ? 'CMD.247.RESPONSE.ENABLED'
                                    : 'CMD.247.RESPONSE.DISABLED',
                            ),
                        )
                        .setFooter({
                            text: isGuildStayEnabled
                                ? await getGuildLocaleString(
                                      interaction.guildId,
                                      'CMD.247.MISC.NOTE',
                                  )
                                : null,
                        }),
                );
                if (!isGuildStayEnabled && !player.playing) {
                    player.queue.emit('finish');
                }
        }
    },
};
