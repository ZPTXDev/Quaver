import { SlashCommandBuilder } from 'discord.js';
import { PlayerResponse, QuaverGuild } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { MessageOptionsBuilderType } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import { getLocaleString } from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('pause')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.PAUSE.DESCRIPTION',
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
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const response = await player.setPause(true);
        switch (response) {
            case PlayerResponse.PlayerStateUnchanged:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.PAUSE.RESPONSE.STATE_UNCHANGED'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.PAUSE.RESPONSE.SUCCESS'),
                    { type: MessageOptionsBuilderType.Success },
                );
        }
    });
