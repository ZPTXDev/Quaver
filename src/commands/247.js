const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale, features } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');
const { data } = require('#lib/util/common.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('247')
		.setDescription(getLocale(defaultLocale, 'CMD_247_DESCRIPTION'))
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription(getLocale(defaultLocale, 'CMD_247_OPTION_ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		if (!features.stay.enabled) {
			await interaction.replyHandler.locale('FEATURE_DISABLED', {}, 'error');
			return;
		}
		if (features.stay.whitelist && !await data.guild.get(interaction.guildId, 'features.stay.whitelisted')) {
			await interaction.replyHandler.locale('CMD_247_NOT_WHITELISTED', {}, 'error');
			return;
		}
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player?.queue?.channel?.id) {
			await interaction.replyHandler.locale('CMD_247_MISSING_CHANNEL', {}, 'error');
			return;
		}
		const enabled = interaction.options.getBoolean('enabled');
		let always;
		if (enabled !== null) {
			always = enabled;
		}
		else {
			always = !await data.guild.get(interaction.guildId, 'settings.stay.enabled');
		}
		await data.guild.set(interaction.guildId, 'settings.stay.enabled', always);
		if (always) {
			await data.guild.set(interaction.guildId, 'settings.stay.channel', player.channelId);
			await data.guild.set(interaction.guildId, 'settings.stay.text', player.queue.channel.id);
		}
		if (player.timeout) {
			clearTimeout(player.timeout);
			delete player.timeout;
		}
		// pause timeout is theoretically impossible because the user would need to be in the same vc as Quaver
		// and pause timeout is only set when everyone leaves
		await interaction.replyHandler.locale(always ? 'CMD_247_ENABLED' : 'CMD_247_DISABLED', { footer: always ? getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD_247_NOTE') : null });
	},
};
