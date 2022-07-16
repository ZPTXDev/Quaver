const { logger } = require('../shared.js');
const { checks } = require('../enums.js');
const ReplyHandler = require('../classes/ReplyHandler.js');

module.exports = {
	name: 'interactionCreate',
	once: false,
	/** @param {import('discord.js').CommandInteraction & {replyHandler: ReplyHandler, client: import('discord.js').Client & {commands: import('discord.js').Collection, music: import('lavaclient').Node}}} interaction */
	async execute(interaction) {
		interaction.replyHandler = new ReplyHandler(interaction);
		if (interaction.isCommand()) {
			/** @type {{data: import('@discordjs/builders').SlashCommandBuilder, checks: string[], permissions: {user: string[], bot: string[]}, execute(interaction: import('discord.js').CommandInteraction): Promise<void>}} */
			const command = interaction.client.commands.get(interaction.commandName);
			if (!command) return;
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing command ${interaction.commandName}`, label: 'Quaver' });
			const failedChecks = [];
			for (const check of command.checks) {
				switch (check) {
					// Only allowed in guild
					case checks.GUILD_ONLY:
						if (!interaction.guildId) {
							failedChecks.push(check);
						}
						break;
					// Must have an active session
					case checks.ACTIVE_SESSION: {
						const player = interaction.client.music.players.get(interaction.guildId);
						if (!player) {
							failedChecks.push(check);
						}
						break;
					}
					// Must be in a voice channel
					case checks.IN_VOICE:
						if (!interaction.member?.voice.channelId) {
							failedChecks.push(check);
						}
						break;
					// Must be in the same voice channel (will not fail if the bot is not in a voice channel)
					case checks.IN_SESSION_VOICE: {
						const player = interaction.client.music.players.get(interaction.guildId);
						if (player && interaction.member?.voice.channelId !== player.channelId) {
							failedChecks.push(check);
						}
						break;
					}
				}
			}
			if (failedChecks.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedChecks.length} check(s)`, label: 'Quaver' });
				await interaction.replyHandler.localeError(failedChecks[0]);
				return;
			}
			const failedPermissions = { user: [], bot: [] };
			if (interaction.guildId) {
				for (const perm of command.permissions.user) {
					if (!interaction.channel.permissionsFor(interaction.member).has(perm)) {
						failedPermissions.user.push(perm);
					}
				}
				for (const perm of ['VIEW_CHANNEL', 'SEND_MESSAGES', ...command.permissions.bot]) {
					if (!interaction.channel.permissionsFor(interaction.client.user.id).has(perm)) {
						failedPermissions.bot.push(perm);
					}
				}
			}
			else {
				failedPermissions.user = command.permissions.user;
				failedPermissions.bot = command.permissions.bot;
			}
			if (failedPermissions.user.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedPermissions.user.length} user permission check(s)`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_USER_MISSING_PERMISSIONS', {}, failedPermissions.user.map(perm => '`' + perm + '`').join(' '));
				return;
			}
			if (failedPermissions.bot.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedPermissions.bot.length} bot permission check(s)`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS', {}, failedPermissions.bot.map(perm => '`' + perm + '`').join(' '));
				return;
			}
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing command ${interaction.commandName}`, label: 'Quaver' });
				await command.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with command ${interaction.commandName}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_GENERIC_ERROR');
			}
		}
		else if (interaction.isButton()) {
			/** @type {{name: string, execute(interaction: import('discord.js').ButtonInteraction): Promise<void)>}} */
			const button = interaction.client.buttons.get(interaction.customId.split('_')[0]);
			if (!button) return;
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing button ${interaction.customId}`, label: 'Quaver' });
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing button ${interaction.customId}`, label: 'Quaver' });
				await button.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with button ${interaction.customId}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_GENERIC_ERROR');
			}
		}
		else if (interaction.isSelectMenu()) {
			/** @type {{name: string, execute(interaction: import('discord.js').SelectMenuInteraction): Promise<void)>}} */
			const select = interaction.client.selects.get(interaction.customId.split('_')[0]);
			if (!select) return;
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing select menu ${interaction.customId}`, label: 'Quaver' });
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing select menu ${interaction.customId}`, label: 'Quaver' });
				await select.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with button ${interaction.customId}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_GENERIC_ERROR');
			}
		}
	},
};
