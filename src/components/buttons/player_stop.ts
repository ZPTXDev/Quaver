import { MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import { confirmationTimeout } from '#src/lib/state';
import { buildMessageOptions, Check } from '#src/lib/util';
import {
    ActionRowBuilder,
    type ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    InteractionCallbackResponse,
    Message,
    SeparatorBuilder,
} from 'discord.js';

export default new ButtonHandler()
    .setChecks([Check.ActiveSession, Check.InVoice, Check.InSessionVoice])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();

        // Check if this is an old player control message
        if (player.memory.currentNowPlayingMessageId &&
            interaction.message.id !== player.memory.currentNowPlayingMessageId) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { type: MessageOptionsBuilderType.Error, ephemeral: true },
            );
            return;
        }

        // Check if an ad is playing
        if (player.memory.isAdPlaying) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.STOP.RESPONSE.ERROR.AD_PLAYING'),
                { type: MessageOptionsBuilderType.Error, ephemeral: true },
            );
            return;
        }

        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                { type: MessageOptionsBuilderType.Error, ephemeral: true },
            );
            return;
        }
        const response = await interaction.replyHandler.reply(
            new ContainerBuilder()
                .addTextDisplayComponents(
                    guild.builders.textDisplayLocale(
                        'CMD.STOP.RESPONSE.CONFIRMATION',
                    ),
                    guild.builders.textDisplayLocale(
                        'MISC.ACTION_IRREVERSIBLE',
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        guild.builders
                            .buttonLocale('MISC.CONFIRM')
                            .setStyle(ButtonStyle.Danger)
                            .setCustomId('stop'),
                        guild.builders
                            .buttonLocale('MISC.CANCEL')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId('cancel'),
                    ),
                ),
            {
                type: MessageOptionsBuilderType.Warning,
                withResponse: true,
                ephemeral: true,
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
            async (g, message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            g.locale('DISCORD.INTERACTION.EXPIRED'),
                            { components: [] },
                        ),
                    );
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error(`${error.message}\n${error.stack}`);
                    }
                }
                delete confirmationTimeout[message.id];
            },
            10_000,
            guild,
            msg,
        );
    });
