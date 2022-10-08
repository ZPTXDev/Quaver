import { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Client, Collection, CommandInteraction, GuildMember, MessageComponentInteraction, ModalSubmitInteraction, PermissionsBitField, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { logger } from '#src/lib/util/common.js';
import { checks } from '#src/lib/util/constants.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node } from 'lavaclient';

export default {
	name: 'interactionCreate',
	once: false,
	async execute(interaction: (CommandInteraction | MessageComponentInteraction | AutocompleteInteraction | ModalSubmitInteraction) & { replyHandler: ReplyHandler, client: Client & { commands: Collection<string, unknown>, buttons: Collection<string, unknown>, selectmenus: Collection<string, unknown>, autocomplete: Collection<string, unknown>, modals: Collection<string, unknown>, music: Node } }): Promise<void> {
		if (interaction.isChatInputCommand()) {
			interaction.replyHandler = new ReplyHandler(interaction);
			const command: {
				data?: SlashCommandBuilder;
				checks?: string[];
				permissions?: { user: bigint[], bot: bigint[] };
				execute?(interaction: ChatInputCommandInteraction): Promise<void>;
			} = interaction.client.commands.get(interaction.commandName);
			if (!command) return;
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing command ${interaction.commandName}`, label: 'Quaver' });
			const failedChecks = [];
			for (const check of command.checks) {
				switch (check) {
					// Only allowed in guild
					case checks.GUILD_ONLY:
						if (!interaction.guildId) failedChecks.push(check);
						break;
					// Must have an active session
					case checks.ACTIVE_SESSION: {
						const player = interaction.client.music.players.get(interaction.guildId);
						if (!player) failedChecks.push(check);
						break;
					}
					// Must be in a voice channel
					case checks.IN_VOICE:
						if (!(interaction.member instanceof GuildMember) || !interaction.member?.voice.channelId) failedChecks.push(check);
						break;
					// Must be in the same voice channel (will not fail if the bot is not in a voice channel)
					case checks.IN_SESSION_VOICE: {
						const player = interaction.client.music.players.get(interaction.guildId);
						if (player && interaction.member instanceof GuildMember && interaction.member?.voice.channelId !== player.channelId) failedChecks.push(check);
						break;
					}
				}
			}
			if (failedChecks.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedChecks.length} check(s)`, label: 'Quaver' });
				await interaction.replyHandler.locale(failedChecks[0], { type: 'error' });
				return;
			}
			const failedPermissions: { user: string[], bot: string[] } = { user: [], bot: [] };
			if (interaction.guildId) {
				failedPermissions.user = interaction.channel.permissionsFor(<GuildMember> interaction.member).missing(command.permissions.user);
				failedPermissions.bot = interaction.channel.permissionsFor(interaction.client.user.id).missing([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, ...command.permissions.bot]);
			}
			else {
				failedPermissions.user = new PermissionsBitField(command.permissions.user).toArray();
				failedPermissions.bot = new PermissionsBitField(command.permissions.bot).toArray();
			}
			if (failedPermissions.user.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedPermissions.user.length} user permission check(s)`, label: 'Quaver' });
				await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.USER', { args: [failedPermissions.user.map((perm): string => `\`${perm}\``).join(' ')], type: 'error' });
				return;
			}
			if (failedPermissions.bot.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedPermissions.bot.length} bot permission check(s)`, label: 'Quaver' });
				await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.DEFAULT', { args: [failedPermissions.bot.map((perm): string => `\`${perm}\``).join(' ')], type: 'error' });
				return;
			}
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing command ${interaction.commandName}`, label: 'Quaver' });
				return command.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with command ${interaction.commandName}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.locale('DISCORD.GENERIC_ERROR', { type: 'error' });
				return;
			}
		}
		if (interaction.isAutocomplete()) {
			const autocomplete = <{ execute(interaction: AutocompleteInteraction): Promise<void> }> interaction.client.autocomplete.get(interaction.commandName);
			if (!autocomplete) return;
			return autocomplete.execute(interaction);
		}
		if (interaction.isButton()) {
			interaction.replyHandler = new ReplyHandler(interaction);
			const button = <{ execute(interaction: ButtonInteraction): Promise<void> }> interaction.client.buttons.get(interaction.customId.split('_')[0]);
			if (!button) return;
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing button ${interaction.customId}`, label: 'Quaver' });
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing button ${interaction.customId}`, label: 'Quaver' });
				return button.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with button ${interaction.customId}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.locale('DISCORD.GENERIC_ERROR', { type: 'error' });
				return;
			}
		}
		if (interaction.isSelectMenu()) {
			interaction.replyHandler = new ReplyHandler(interaction);
			const selectmenu = <{ execute(interaction: SelectMenuInteraction): Promise<void> }> interaction.client.selectmenus.get(interaction.customId.split('_')[0]);
			if (!selectmenu) return;
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing select menu ${interaction.customId}`, label: 'Quaver' });
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing select menu ${interaction.customId}`, label: 'Quaver' });
				return selectmenu.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with select menu ${interaction.customId}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.locale('DISCORD.GENERIC_ERROR', { type: 'error' });
				return;
			}
		}
		if (interaction.isModalSubmit()) {
			const modal = <{ execute(interaction: ModalSubmitInteraction): Promise<void> }> interaction.client.modals.get(interaction.customId.split('_')[0]);
			if (!modal) return;
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing modal ${interaction.customId}`, label: 'Quaver' });
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing modal ${interaction.customId}`, label: 'Quaver' });
				return modal.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with modal ${interaction.customId}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.locale('DISCORD.GENERIC_ERROR', { type: 'error' });
				return;
			}
		}
	},
};
