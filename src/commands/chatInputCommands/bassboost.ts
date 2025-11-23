import {
    ContainerBuilder,
    type SlashCommandBooleanOption,
    SlashCommandBuilder,
} from 'discord.js';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { PlayerResponse } from '#src/lib/music';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import { getLocaleString } from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('bassboost')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.BASSBOOST.DESCRIPTION',
                ),
            )
            .addBooleanOption(
                (option): SlashCommandBooleanOption =>
                    option
                        .setName('enabled')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.BASSBOOST.OPTION.ENABLED',
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
    .setExecute(async function (interaction): Promise<void> {
        const enabled = interaction.options.getBoolean('enabled');
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const response = await player.setBassboost(
            enabled !== null ? enabled : !player.memory.bassboost,
        );
        if (response !== PlayerResponse.Success) return;
        await interaction.replyHandler.reply(
            new ContainerBuilder().addTextDisplayComponents(
                guild.builders.textDisplayLocale(
                    player.memory.bassboost
                        ? 'CMD.BASSBOOST.RESPONSE.ENABLED'
                        : 'CMD.BASSBOOST.RESPONSE.DISABLED',
                ),
                guild.builders.textDisplayLocale('MUSIC.PLAYER.FILTER_NOTE'),
            ),
        );
    });
