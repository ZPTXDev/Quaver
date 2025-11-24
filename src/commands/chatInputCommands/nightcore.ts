import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import { Check, settings } from '#src/lib/util';
import {
    ContainerBuilder,
    type SlashCommandBooleanOption,
    SlashCommandBuilder,
} from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('nightcore')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.NIGHTCORE.DESCRIPTION',
                ),
            )
            .addBooleanOption(
                (option): SlashCommandBooleanOption =>
                    option
                        .setName('enabled')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.NIGHTCORE.OPTION.ENABLED',
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
        const response = await player.setNightcore(
            enabled !== null ? enabled : !player.memory.nightcore,
        );
        if (response !== PlayerResponse.Success) return;
        await interaction.replyHandler.reply(
            new ContainerBuilder().addTextDisplayComponents(
                guild.builders.textDisplayLocale(
                    player.memory.nightcore
                        ? 'CMD.NIGHTCORE.RESPONSE.ENABLED'
                        : 'CMD.NIGHTCORE.RESPONSE.DISABLED',
                ),
                guild.builders.textDisplayLocale('MUSIC.PLAYER.FILTER_NOTE'),
            ),
        );
    });
