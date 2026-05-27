import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import { Check, getPremiumURL, settings } from '#src/lib/util';
import { ActionRowBuilder, type ButtonBuilder, ButtonStyle, ContainerBuilder, SlashCommandBuilder } from 'discord.js';

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

        // Check if an ad is playing
        if (player.memory.isAdPlaying) {
            const premiumURL = getPremiumURL(interaction.guild.id);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    guild.builders.textDisplayLocale('CMD.RESUME.RESPONSE.ERROR.AD_PLAYING'),
                );

            if (premiumURL) {
                container.addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().setComponents(
                        guild.builders
                            .buttonLocale('MISC.GET_PREMIUM')
                            .setStyle(ButtonStyle.Link)
                            .setURL(premiumURL),
                    ),
                );
            }

            await interaction.replyHandler.reply(container, {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }

        const response = await player.setPause(false, interaction.user);
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
