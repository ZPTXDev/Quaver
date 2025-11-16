import {
    ActionRowBuilder,
    type ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    InteractionCallbackResponse,
    Message,
    SeparatorBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import { QuaverGuild } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import {
    confirmationTimeout,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import { buildMessageOptions, getLocaleString } from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.STOP.DESCRIPTION',
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
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                { type: MessageOptionsBuilderType.Error },
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
                        logger.error({
                            message: `${error.message}\n${error.stack}`,
                            label: 'Quaver',
                        });
                    }
                }
                delete confirmationTimeout[message.id];
            },
            10_000,
            guild,
            msg,
        );
    });
