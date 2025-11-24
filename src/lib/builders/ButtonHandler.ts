import type { QuaverInteraction } from '#src/lib/interactions';
import type { ButtonInteraction } from 'discord.js';
import { BaseHandler } from '.';

type GenericButtonExecuteFunction = (
    this: ButtonHandler,
    interaction: QuaverInteraction<ButtonInteraction>,
) => Promise<void> | void;

export class ButtonHandler extends BaseHandler {
    execute: GenericButtonExecuteFunction;

    setExecute(execute: GenericButtonExecuteFunction): this {
        this.execute = execute.bind(this);
        return this;
    }
}
