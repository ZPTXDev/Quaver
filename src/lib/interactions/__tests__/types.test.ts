import { describe, it, expect } from 'vitest';
import type { InteractionHandlerMapsFlat } from '../types';

describe('interactions/types', () => {
describe('Interaction type unions', () => {
it('should support all command interaction types', () => {
const commandTypes = [
'ChatInputCommand',
'ContextMenuCommand',
'MessageContextMenuCommand',
'UserContextMenuCommand',
];
expect(commandTypes).toHaveLength(4);
});

it('should support all component interaction types', () => {
const componentTypes = [
'Button',
'ChannelSelectMenu',
'MentionableSelectMenu',
'MessageComponent',
'ModalMessageModalSubmit',
'ModalSubmit',
'RoleSelectMenu',
'StringSelectMenu',
'UserSelectMenu',
];
expect(componentTypes).toHaveLength(9);
});
});

describe('InteractionHandlerMapsFlat structure', () => {
it('should flatten all handler maps', () => {
const flatMapKeys = [
'autocompletes',
'buttons',
'channelSelectMenus',
'chatInputCommands',
'mentionableSelectMenus',
'messageContextMenuCommands',
'modalSubmits',
'roleSelectMenus',
'stringSelectMenus',
'userContextMenuCommands',
'userSelectMenus',
];
expect(flatMapKeys).toHaveLength(11);
});

it('should support optional handler maps', () => {
const partialMap: Partial<InteractionHandlerMapsFlat> = {
autocompletes: undefined,
buttons: undefined,
};
expect(partialMap.autocompletes).toBeUndefined();
expect(partialMap.buttons).toBeUndefined();
});
});
});
