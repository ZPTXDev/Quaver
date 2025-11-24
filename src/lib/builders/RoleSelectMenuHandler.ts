import type { QuaverInteraction } from '#src/lib/interactions';
import type { RoleSelectMenuInteraction } from 'discord.js';
import { BaseHandler } from '.';

type GenericRoleSelectMenuExecuteFunction = (
    this: RoleSelectMenuHandler,
    interaction: QuaverInteraction<RoleSelectMenuInteraction>,
) => Promise<void> | void;

export class RoleSelectMenuHandler extends BaseHandler {
    execute: GenericRoleSelectMenuExecuteFunction;

    setExecute(execute: GenericRoleSelectMenuExecuteFunction): this {
        this.execute = execute.bind(this);
        return this;
    }
}
