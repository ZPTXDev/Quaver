import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { logger } from '#src/lib/logger';
import { confirmationTimeout } from '#src/lib/state';
import { buildMessageOptions, Check, settings } from '#src/lib/util';
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

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.CLEAR.DESCRIPTION',
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
        if (player.queue.tracks.length === 0) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.CLEAR.RESPONSE.QUEUE_EMPTY'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const response = await interaction.replyHandler.reply(
            new ContainerBuilder()
                .addTextDisplayComponents(
                    guild.builders.textDisplayLocale(
                        'CMD.CLEAR.RESPONSE.CONFIRMATION',
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
                            .setCustomId('clear'),
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
