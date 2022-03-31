const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');
const { checks } = require('../enums.js');
const { msToTime, msToTimeString } = require('../functions.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../shared.js');

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts

module.exports = {
	data: new SlashCommandBuilder()
		.setName('search')
		.setDescription(getLocale(defaultLocale, 'CMD_SEARCH_DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('query')
				.setDescription(getLocale(defaultLocale, 'CMD_SEARCH_OPTION_QUERY'))
				.setRequired(true)),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		await interaction.deferReply();
		const query = interaction.options.getString('query');
		let tracks = [];

		const results = await interaction.client.music.rest.loadTracks(`ytsearch:${query}`);

		switch (results.loadType) {
			case 'SEARCH_RESULT': {
				tracks = results.tracks;
				break;
			}
		}

		tracks = tracks.slice(0, 10);

		if (tracks.length <= 1) {
			await interaction.editReply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEARCH_USE_PLAY_CMD'))
						.setColor('DARK_RED'),
				],
			});
			return;
		}

		await interaction.editReply({
			embeds: [
				new MessageEmbed()
					.setDescription(tracks.map((track, index) => {
						const duration = msToTime(track.info.length);
						const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${(index + 1).toString().padStart(tracks.length.toString().length, ' ')}.\` **[${track.info.title}](${track.info.uri})** \`[${durationString}]\``;
					}).join('\n'))
					.setColor(defaultColor),
			],
			components: [
				new MessageActionRow()
					.addComponents(
						new MessageSelectMenu()
							.setCustomId(`play_${interaction.user.id}`)
							.setPlaceholder(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEARCH_PICK'))
							.addOptions(tracks.map((track, index) => {
								let label = `${index + 1}. ${track.info.title}`;
								if (label.length >= 100) {
									label = `${label.substring(0, 97)}...`;
								}
								return { label: label, description: track.info.author, value: track.info.identifier };
							}))
							.setMinValues(1)
							.setMaxValues(Math.min(tracks.length, 10)),
					),
				new MessageActionRow()
					.addComponents(
						new MessageButton()
							.setCustomId(`cancel_${interaction.user.id}`)
							.setLabel(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CANCEL'))
							.setStyle('DANGER'),
					),
			],
			ephemeral: true,
		});
	},
};
