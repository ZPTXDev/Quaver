import type { AutocompleteInteraction } from 'discord.js';
import { BaseHandler } from '.';
import type { QuaverInteraction } from '#src/lib/util/common.d';

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
