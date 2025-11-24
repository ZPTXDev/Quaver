import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import { Check, settings } from '#src/lib/util';
import type { SlashCommandBooleanOption } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('shuffle')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.SHUFFLE.DESCRIPTION',
                ),
            )
            .addBooleanOption(
                (option): SlashCommandBooleanOption =>
                    option
                        .setName('enabled')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.SHUFFLE.OPTION.ENABLED',
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
        const response = await player.setShuffle(
            enabled !== null ? enabled : !player.memory.shuffle,
        );
        if (response !== PlayerResponse.Success) return;
        await interaction.replyHandler.reply(
            guild.locale(
                player.memory.shuffle
                    ? 'CMD.SHUFFLE.RESPONSE.ENABLED'
                    : 'CMD.SHUFFLE.RESPONSE.DISABLED',
            ),
        );
    });
