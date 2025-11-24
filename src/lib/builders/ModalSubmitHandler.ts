import type { QuaverInteraction } from '#src/lib/interactions';
import type { ModalSubmitInteraction } from 'discord.js';
import { BaseHandler } from '.';

type GenericModalSubmitExecuteFunction = (
    this: ModalSubmitHandler,
    interaction: QuaverInteraction<ModalSubmitInteraction>,
) => Promise<void> | void;

export class ModalSubmitHandler extends BaseHandler {
    execute: GenericModalSubmitExecuteFunction;

    setExecute(execute: GenericModalSubmitExecuteFunction): this {
        this.execute = execute.bind(this);
        return this;
    }
}
