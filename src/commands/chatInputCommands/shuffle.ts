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
            .setName('shuffle')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.SHUFFLE.DESCRIPTION',
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
        const response = await player.shuffleQueue();
        switch (response) {
            case PlayerResponse.QueueInsufficientTracks:
                await interaction.replyHandler.reply(
                    guild.locale(
                        'CMD.SHUFFLE.RESPONSE.QUEUE_INSUFFICIENT_TRACKS',
                    ),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.SHUFFLE.RESPONSE.SUCCESS'),
                    { type: MessageOptionsBuilderType.Success },
                );
        }
    });
