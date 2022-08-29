import { SlashCommandBuilder, ActionRowBuilder, SelectMenuBuilder, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getGuildLocale, getLocale, msToTime, msToTimeString, paginate } from '#lib/util/util.js';

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts

export default {
	data: new SlashCommandBuilder()
		.setName('search')
		.setDescription(getLocale(defaultLocale, 'CMD.SEARCH.DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('query')
				.setDescription(getLocale(defaultLocale, 'CMD.SEARCH.OPTION.QUERY'))
				.setRequired(true)
				.setAutocomplete(true)),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(interaction.channel.type)) return interaction.replyHandler.locale('DISCORD.CHANNEL_UNSUPPORTED', { type: 'error' });
		await interaction.replyHandler.locale('MISC.LOADING', { ephemeral: true });
		const query = interaction.options.getString('query');
		let tracks = [];

		const results = await interaction.client.music.rest.loadTracks(`ytsearch:${query}`);
		if (results.loadType === 'SEARCH_RESULT') tracks = results.tracks;

		if (tracks.length <= 1) return interaction.replyHandler.locale('CMD.SEARCH.RESPONSE.USE_PLAY_CMD', { type: 'error' });

		const pages = paginate(tracks, 10);
		interaction.client.music.pages = pages;
		return interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(
					pages[0].map((track, index) => {
						const duration = msToTime(track.info.length);
						const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${(index + 1).toString().padStart(tracks.length.toString().length, ' ')}.\` **[${track.info.title.length >= 50 ? `${track.info.title.substring(0, 47)}...` : track.info.title}](${track.info.uri})** \`[${durationString}]\``;
					}).join('\n'),
				)
				.setFooter({ text: await getGuildLocale(interaction.guildId, 'MISC.PAGE', '1', pages.length) }),
			{
				components: [
					new ActionRowBuilder()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('play')
								.setPlaceholder(await getGuildLocale(interaction.guildId, 'CMD.SEARCH.MISC.PICK'))
								.addOptions(pages[0].map((track, index) => {
									let label = `${index + 1}. ${track.info.title}`;
									if (label.length >= 100) label = `${label.substring(0, 97)}...`;
									return { label: label, description: track.info.author, value: track.info.identifier };
								}))
								.setMinValues(1)
								.setMaxValues(Math.min(pages[0].length, 10)),
						),
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('search_0')
								.setEmoji('⬅️')
								.setDisabled(true)
								.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
								.setCustomId('search_goto')
								.setStyle(ButtonStyle.Secondary)
								.setLabel(await getGuildLocale(interaction.guildId, 'MISC.GO_TO')),
							new ButtonBuilder()
								.setCustomId('search_2')
								.setEmoji('➡️')
								.setDisabled(pages.length === 1)
								.setStyle(ButtonStyle.Primary),
						),
				],
			},
		);
	},
};
