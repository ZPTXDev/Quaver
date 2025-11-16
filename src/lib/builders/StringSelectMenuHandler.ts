import type { StringSelectMenuInteraction } from 'discord.js';
import { BaseHandler } from '.';
import type { QuaverInteraction } from '#src/lib/util/common.d';

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
