import type { ForceType } from '.';

export type AdditionalBuilderOptions = {
    ephemeral?: boolean;
    force?: ForceType;
    withResponse?: boolean;
};
