import type { Check } from '#src/lib/util/constants.js';
import type {
    AutocompleteInteraction,
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    PermissionsBitField,
    SelectMenuInteraction,
    SlashCommandBuilder,
} from 'discord.js';

export type ChatInputCommand = {
    data?: SlashCommandBuilder;
    checks?: Check[];
    permissions?: { user: PermissionsBitField[]; bot: PermissionsBitField[] };
    execute?(interaction: ChatInputCommandInteraction): Promise<void>;
};

export type Autocomplete = {
    name: string;
    checks?: Check[];
    execute(interaction: AutocompleteInteraction): Promise<void>;
};

export type Button = {
    name: string;
    checks?: Check[];
    execute(interaction: ButtonInteraction): Promise<void>;
};

export type SelectMenu = {
    name: string;
    checks?: Check[];
    execute(interaction: SelectMenuInteraction): Promise<void>;
};

export type ModalSubmit = {
    name: string;
    checks?: Check[];
    execute(interaction: ModalSubmitInteraction): Promise<void>;
};
