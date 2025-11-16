import {
    ActionRowBuilder,
    type ApplicationCommandManager,
    type ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    type SlashCommandBooleanOption,
    SlashCommandBuilder,
} from 'discord.js';
import { PlayerResponse, QuaverGuild } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { MessageOptionsBuilderType } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import { getLocaleString } from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('247')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.247.DESCRIPTION',
                ),
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
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function(interaction): Promise<void> {
        const enabled = interaction.options.getBoolean('enabled');
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        // if the user has provided a preference, its input boolean value is used as the guild's stay.enabled value
        // if the user simply used the slash command without using the enabled option, toggling it in a sense,
        // it defaults to opposite of the stay.enabled value stored from the guild's data.
        const isGuildStayEnabled =
            enabled !== null
                ? enabled
                : !(await guild.settings.get('stay.enabled'));
        const response = await player.setStay(isGuildStayEnabled);
        switch (response) {
            case PlayerResponse.FeatureDisabled:
                await interaction.replyHandler.reply(
                    guild.locale('FEATURE.DISABLED.DEFAULT'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.FeatureNotWhitelisted:
                if (settings.features.stay.premium && settings.premiumURL) {
                    await interaction.replyHandler.reply(
                        new ContainerBuilder()
                            .addTextDisplayComponents(
                                guild.builders.textDisplayLocale(
                                    'FEATURE.NO_PERMISSION.PREMIUM',
                                ),
                            )
                            .addActionRowComponents(
                                new ActionRowBuilder<ButtonBuilder>().setComponents(
                                    guild.builders
                                        .buttonLocale('MISC.GET_PREMIUM')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(settings.premiumURL),
                                ),
                            ),
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                }
                await interaction.replyHandler.reply(
                    guild.locale('FEATURE.NO_PERMISSION.DEFAULT'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.QueueChannelMissing: {
                const applicationCommands: ApplicationCommandManager =
                    interaction.client.application?.commands;
                if (applicationCommands?.cache.size === 0) {
                    await applicationCommands.fetch();
                }
                await interaction.replyHandler.reply(
                    guild.locale(
                        'CMD.247.RESPONSE.QUEUE_CHANNEL_MISSING',
                        applicationCommands.cache.find(
                            (command): boolean => command.name === 'bind',
                        )?.id ?? '1',
                    ),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            case PlayerResponse.Success: {
                // pause timeout is theoretically impossible because the user would need to be in the same vc as Quaver
                // and pause timeout is only set when everyone leaves
                await interaction.replyHandler.reply(
                    new ContainerBuilder().addTextDisplayComponents(
                        guild.builders.textDisplayLocale(
                            isGuildStayEnabled
                                ? 'CMD.247.RESPONSE.ENABLED'
                                : 'CMD.247.RESPONSE.DISABLED',
                        ),
                        ...(isGuildStayEnabled
                            ? [
                                  guild.builders.textDisplayLocale(
                                      'CMD.247.MISC.NOTE',
                                  ),
                              ]
                            : []),
                    ),
                );
                if (!isGuildStayEnabled && !player.playing) {
                    player.queue.emit('finish');
                }
            }
        }
    });
