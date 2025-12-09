import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import { Check, settings } from '#src/lib/util';
import { SlashCommandBuilder } from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('resume')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.RESUME.DESCRIPTION',
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
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const response = await player.setPause(false);
        switch (response) {
            case PlayerResponse.RestartInProgress:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.PlayerStateUnchanged:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.RESUME.RESPONSE.STATE_UNCHANGED'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.RESUME.RESPONSE.SUCCESS'),
                    { type: MessageOptionsBuilderType.Success },
                );
        }
    });
