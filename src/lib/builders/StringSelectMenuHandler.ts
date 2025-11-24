import type { QuaverInteraction } from '#src/lib/interactions';
import type { StringSelectMenuInteraction } from 'discord.js';
import { BaseHandler } from '.';

type GenericStringSelectMenuExecuteFunction = (
    this: StringSelectMenuHandler,
    interaction: QuaverInteraction<StringSelectMenuInteraction>,
) => Promise<void> | void;

export class StringSelectMenuHandler extends BaseHandler {
    execute: GenericStringSelectMenuExecuteFunction;

    setExecute(execute: GenericStringSelectMenuExecuteFunction): this {
        this.execute = execute.bind(this);
        return this;
    }
}
