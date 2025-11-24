import type { QuaverInteraction } from '#src/lib/interactions';
import type { AutocompleteInteraction } from 'discord.js';
import { BaseHandler } from '.';

type GenericAutocompleteExecuteFunction = (
    this: AutocompleteHandler,
    interaction: QuaverInteraction<AutocompleteInteraction>,
) => Promise<void> | void;

export class AutocompleteHandler extends BaseHandler {
    execute: GenericAutocompleteExecuteFunction;

    setExecute(execute: GenericAutocompleteExecuteFunction): this {
        this.execute = execute.bind(this);
        return this;
    }
}
