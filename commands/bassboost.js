const { SlashCommandBuilder } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { data } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bassboost')
		.setDescription(getLocale(defaultLocale, 'CMD_BASSBOOST_DESCRIPTION'))
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription(getLocale(defaultLocale, 'CMD_BASSBOOST_OPTION_ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const enabled = interaction.options.getBoolean('enabled');
		let boost;
		if (enabled !== null) {
			boost = enabled;
		}
		else {
			boost = !player.bassboost;
		}
		let eqValues = new Array(15).fill(0);
		if (boost) {
			eqValues = [0.2, 0.15, 0.1, 0.05, 0.0, ...new Array(10).fill(-0.05)];
		}
		await player.setEqualizer(eqValues);
		player.bassboost = boost;
		await interaction.replyHandler.locale(player.bassboost ? 'CMD_BASSBOOST_ENABLED' : 'CMD_BASSBOOST_DISABLED', { footer: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_FILTERS_NOTE') });
	},
};
