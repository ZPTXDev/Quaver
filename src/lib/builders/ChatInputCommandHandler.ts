import { MessageOptionsBuilderType } from '#src/lib';
import { QuaverGuild } from '#src/lib/guild';
import type { QuaverInteraction } from '#src/lib/interactions';
import { getLocaleString } from '#src/lib/locales';
import { settings } from '#src/lib/util';
import {
    type ChatInputCommandInteraction,
    PermissionsBitField,
    type PermissionsString,
    type SlashCommandBuilder,
    type SlashCommandOptionsOnlyBuilder,
    type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { BaseHandler, type ChatInputCommandPermissions } from '.';

type GenericChatInputCommandExecuteFunction = (
    this: ChatInputCommandInteraction,
    interaction: QuaverInteraction<ChatInputCommandInteraction>,
) => Promise<void> | void;

type FailedCommandPermissions = {
    user: PermissionsString[];
    bot: PermissionsString[];
};

type SlashCommandBuilders =
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;

export class ChatInputCommandHandler extends BaseHandler {
    data: SlashCommandBuilders;
    execute: GenericChatInputCommandExecuteFunction;
    permissions: ChatInputCommandPermissions = { user: [], bot: [] };

    /**
     * Sets the SlashCommandBuilder data for this handler.
     * @param data - The SlashCommandBuilder data.
     * @returns This instance for chaining.
     */
    setData(data: SlashCommandBuilders): this {
        this.data = data;
        return this;
    }

    setExecute(execute: GenericChatInputCommandExecuteFunction): this {
        this.execute = execute.bind(this);
        return this;
    }

    setPermissions(permissions: ChatInputCommandPermissions): this {
        this.permissions = permissions;
        return this;
    }

    /**
     * Checks the required command permissions for the user and client in a specific guild or direct message context
     * and returns the permissions that are missing for each.
     *
     * This function calculates the missing permissions for the user and client, either from the interaction
     * channel in a guild or from a direct message context. If the interaction occurs in a guild, it checks
     * the permissions for the user and client within the specific channel and returns the missing permissions.
     * In the case of a direct message, it simply returns the permissions that the handler expects the user
     * and client to have.
     *
     * @param interaction - The interaction object, which contains
     * the channel and member information required to check permissions.
     *
     * @returns An object containing two arrays:
     * - `user`: The permissions that the user is missing in the current context.
     * - `client`: The permissions that the client is missing in the current context.
     */
    getFailedPermissions(
        interaction: QuaverInteraction<ChatInputCommandInteraction<'cached'>>,
    ): FailedCommandPermissions {
        if (interaction.inGuild()) {
            return {
                user: interaction.channel
                    .permissionsFor(interaction.member)
                    .missing(this.permissions.user),
                bot: interaction.channel
                    .permissionsFor(interaction.client.user.id)
                    .missing([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        ...this.permissions.bot,
                    ]),
            };
        }
        return {
            user: new PermissionsBitField(this.permissions.user).toArray(),
            bot: new PermissionsBitField(this.permissions.bot).toArray(),
        };
    }

    /**
     * Handles a command interaction, extracts user and client permissions from the interaction handler and checks for necessary permissions.
     *
     * @param interaction - The command interaction to check.
     * @returns Resolves to `true` if the command is permitted to proceed, `false` if permissions fail.
     */
    async handlePermissionsCheck(
        interaction: QuaverInteraction<ChatInputCommandInteraction<'cached'>>,
    ): Promise<{ type: 'success' | 'user' | 'bot'; count: number }> {
        const guild = interaction.inGuild()
            ? await QuaverGuild.wrap(interaction.guild)
            : null;
        const failedPermissions = this.getFailedPermissions(interaction);
        if (failedPermissions.user.length > 0) {
            await interaction.replyHandler.reply(
                guild
                    ? guild.locale(
                          'DISCORD.INSUFFICIENT_PERMISSIONS.USER',
                          failedPermissions.user
                              .map((perm): string => `\`${perm}\``)
                              .join(' '),
                      )
                    : getLocaleString(
                          settings.defaultLocaleCode,
                          'DISCORD.INSUFFICIENT_PERMISSIONS.USER',
                          failedPermissions.user
                              .map((perm): string => `\`${perm}\``)
                              .join(' '),
                      ),
                { type: MessageOptionsBuilderType.Error },
            );
            return { type: 'user', count: failedPermissions.user.length };
        }
        if (failedPermissions.bot.length > 0) {
            if (
                failedPermissions.bot.includes('ViewChannel') ||
                failedPermissions.bot.includes('SendMessages')
            ) {
                await interaction.replyHandler.reply(
                    guild
                        ? guild.locale(
                              'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.VIEW',
                          )
                        : getLocaleString(
                              settings.defaultLocaleCode,
                              'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.VIEW',
                          ),
                    { type: MessageOptionsBuilderType.Error },
                );
                return { type: 'bot', count: failedPermissions.bot.length };
            }
            await interaction.replyHandler.reply(
                guild
                    ? guild.locale(
                          'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.DEFAULT',
                          failedPermissions.bot
                              .map((perm): string => `\`${perm}\``)
                              .join(' '),
                      )
                    : getLocaleString(
                          settings.defaultLocaleCode,
                          'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.DEFAULT',
                          failedPermissions.bot
                              .map((perm): string => `\`${perm}\``)
                              .join(' '),
                      ),
                { type: MessageOptionsBuilderType.Error },
            );
            return { type: 'bot', count: failedPermissions.bot.length };
        }
        return { type: 'success', count: 0 };
    }

    /**
     * Validates the handler, ensuring the SlashCommandBuilder data and execute function are set.
     * @returns Whether the handler is valid.
     */
    validate(): boolean {
        return (
            this.data?.constructor.name === 'SlashCommandBuilder' &&
            typeof this.execute === 'function'
        );
    }
}
