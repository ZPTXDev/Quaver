const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');
const { data } = require('#lib/util/common.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('nightcore')
		.setDescription(getLocale(defaultLocale, 'CMD_NIGHTCORE_DESCRIPTION'))
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription(getLocale(defaultLocale, 'CMD_NIGHTCORE_OPTION_ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const enabled = interaction.options.getBoolean('enabled');
		let nightcore;
		if (enabled !== null) {
			nightcore = enabled;
		}
		else {
			nightcore = !player.nightcore;
		}
		player.filters.timescale = nightcore ? { speed: 1.125, pitch: 1.125, rate: 1 } : undefined;
		await player.setFilters();
		player.nightcore = nightcore;
		await interaction.replyHandler.locale(player.nightcore ? 'CMD_NIGHTCORE_ENABLED' : 'CMD_NIGHTCORE_DISABLED', { footer: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_FILTERS_NOTE') }, 'neutral');
	},
};
