import { GuildMember, type Snowflake } from 'discord.js';
import type {
    AcceptedEventTypes,
    AutocompleteHandler,
    ButtonHandler,
    ChatInputCommandHandler,
    EventHandler,
    ModalSubmitHandler,
    RoleSelectMenuHandler,
    StringSelectMenuHandler,
} from '.';
import type {
    AllInteractions,
    ComponentInteractions,
    QuaverClient,
} from '#src/lib';
import { Check } from '#src/lib/util/constants';

// only exported for builders extending from BaseHandler
export type GenericExecuteFunction = (
    ...args: unknown[]
) => Promise<void> | void;

export abstract class BaseHandler {
    checks: Check[] = [];
    abstract execute: GenericExecuteFunction;
    readonly type: string = this.constructor.name;

    setChecks(checks: Check[]): this {
        this.checks = checks;
        return this;
    }

    /**
     * Sets the execute function for this handler.
     * @param execute - The execute function.
     * @returns This instance for chaining.
     */
    abstract setExecute(
        this: BaseHandler,
        execute: GenericExecuteFunction,
    ): this;

    /**
     * Validates the handler, ensuring the execute function is set.
     * @returns Whether the handler is valid.
     */
    validate(): boolean {
        return typeof this.execute === 'function';
    }

    private isComponentInteraction(
        interaction: AllInteractions,
    ): interaction is ComponentInteractions {
        return (
            interaction.isButton() ||
            interaction.isModalSubmit() ||
            interaction.isRoleSelectMenu() ||
            interaction.isStringSelectMenu()
        );
    }

    /**
     * Returns all failed checks.
     * @param guildIdOrInteraction - The guild ID or interaction.
     * @param member - The member to check, if guild ID was provided.
     * @param interaction - The interaction, only required if checking for InteractionStarter.
     * @returns All failed checks.
     */
    async getFailedChecks(
        guildIdOrInteraction: Snowflake | AllInteractions,
        member?: GuildMember & { client: QuaverClient },
        interaction?: ComponentInteractions,
    ): Promise<Check[]> {
        const guildIdProvided = typeof guildIdOrInteraction === 'string';
        const data = {
            guildId: guildIdProvided
                ? guildIdOrInteraction
                : guildIdOrInteraction.guild?.id,
            member: guildIdProvided
                ? member
                : (guildIdOrInteraction.member as GuildMember & {
                      client: QuaverClient;
                  }),
            interaction: guildIdProvided
                ? (interaction as ComponentInteractions)
                : (guildIdOrInteraction as AllInteractions),
        };
        if (!data.member) {
            throw new Error(
                'Member must be provided when guild ID is provided.',
            );
        }
        const failedChecks: Check[] = [];
        for (const check of this.checks) {
            switch (check) {
                case Check.GuildOnly:
                    if (!data.guildId) failedChecks.push(check);
                    break;
                case Check.ActiveSession: {
                    if (!data.guildId) {
                        failedChecks.push(check);
                        break;
                    }
                    const player = await data.member.client.music.players.fetch(
                        data.guildId,
                    );
                    if (!player) failedChecks.push(check);
                    break;
                }
                case Check.InVoice:
                    if (
                        !(data.member instanceof GuildMember) ||
                        !data.member?.voice.channelId
                    ) {
                        failedChecks.push(check);
                    }
                    break;
                case Check.InSessionVoice: {
                    const player =
                        await data.member?.client.music.players.fetch(
                            data.guildId,
                        );
                    if (
                        player &&
                        data.member instanceof GuildMember &&
                        data.member?.voice.channelId !== player.voice.channelId
                    ) {
                        failedChecks.push(check);
                    }
                    break;
                }
                case Check.InteractionStarter: {
                    if (
                        this.isComponentInteraction(data.interaction) &&
                        data.interaction.message.interactionMetadata.user.id !==
                            data.member.id
                    ) {
                        failedChecks.push(check);
                    }
                }
            }
        }
        return failedChecks;
    }

    /**
     * Checks if this handler is an unconfigured handler.
     * @returns Whether this handler is an unconfigured handler.
     */
    isUnconfiguredHandler(): this is BaseHandler {
        return this.type === 'BaseHandler';
    }

    /**
     * Checks if this handler is an event handler.
     * @returns Whether this handler is an event handler.
     */
    isEventHandler(): this is EventHandler<AcceptedEventTypes> {
        return this.type === 'EventHandler';
    }

    /**
     * Checks if this handler is an autocomplete handler.
     * @returns Whether this handler is an autocomplete handler.
     */
    isAutocompleteHandler(): this is AutocompleteHandler {
        return this.type === 'AutocompleteHandler';
    }

    /**
     * Checks if this handler is a button handler.
     * @returns Whether this handler is a button handler.
     */
    isButtonHandler(): this is ButtonHandler {
        return this.type === 'ButtonHandler';
    }

    /**
     * Checks if this handler is a chat input command handler.
     * @returns Whether this handler is a chat input command handler.
     */
    isChatInputCommandHandler(): this is ChatInputCommandHandler {
        return this.type === 'ChatInputCommandHandler';
    }

    /**
     * Checks if this handler is a modal submit handler.
     * @returns Whether this handler is a modal submit handler.
     */
    isModalSubmitHandler(): this is ModalSubmitHandler {
        return this.type === 'ModalSubmitHandler';
    }

    /**
     * Checks if this handler is a role select menu handler.
     * @returns Whether this handler is a role select menu handler.
     */
    isRoleSelectMenuHandler(): this is RoleSelectMenuHandler {
        return this.type === 'RoleSelectMenuHandler';
    }

    /**
     * Checks if this handler is a string select menu handler.
     * @returns Whether this handler is a string select menu handler.
     */
    isStringSelectMenuHandler(): this is StringSelectMenuHandler {
        return this.type === 'StringSelectMenuHandler';
    }

    /**
     * Checks if this handler is a component handler.
     * @returns Whether this handler is a component handler.
     */
    isComponentHandler(): this is
        | ButtonHandler
        | ModalSubmitHandler
        | RoleSelectMenuHandler
        | StringSelectMenuHandler {
        return (
            this.isButtonHandler() ||
            this.isModalSubmitHandler() ||
            this.isRoleSelectMenuHandler() ||
            this.isStringSelectMenuHandler()
        );
    }
}
