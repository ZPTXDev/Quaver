import { SlashCommandBuilder, ActionRowBuilder, SelectMenuBuilder, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } from 'discord.js';
import { defaultLocaleCode } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getGuildLocaleString, getLocaleString, buildMessageOptions, msToTime, msToTimeString, paginate } from '#lib/util/util.js';
import { logger, searchState } from '#lib/util/common.js';

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts

export default {
	data: new SlashCommandBuilder()
		.setName('search')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.SEARCH.DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('query')
				.setDescription(getLocaleString(defaultLocaleCode, 'CMD.SEARCH.OPTION.QUERY'))
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
		await interaction.deferReply();
		const query = interaction.options.getString('query');
		let tracks = [];

		const results = await interaction.client.music.rest.loadTracks(`ytsearch:${query}`);
		if (results.loadType === 'SEARCH_RESULT') tracks = results.tracks;

		if (tracks.length <= 1) return interaction.replyHandler.locale('CMD.SEARCH.RESPONSE.USE_PLAY_CMD', { type: 'error' });

		const pages = paginate(tracks, 10);
		const msg = await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(
					pages[0].map((track, index) => {
						const duration = msToTime(track.info.length);
						const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${(index + 1).toString().padStart(tracks.length.toString().length, ' ')}.\` **[${escapeMarkdown(track.info.title)}](${track.info.uri})** \`[${durationString}]\``;
					}).join('\n'),
				)
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.PAGE', '1', pages.length) }),
			{
				components: [
					new ActionRowBuilder()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('search')
								.setPlaceholder(await getGuildLocaleString(interaction.guildId, 'CMD.SEARCH.MISC.PICK'))
								.addOptions(pages[0].map((track, index) => {
									let label = `${index + 1}. ${track.info.title}`;
									if (label.length >= 100) label = `${label.substring(0, 97)}...`;
									return { label: label, description: track.info.author, value: track.info.identifier };
								}))
								.setMinValues(0)
								.setMaxValues(pages[0].length),
						),
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('search_0')
								.setEmoji('⬅️')
								.setDisabled(true)
								.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
								.setCustomId('search_2')
								.setEmoji('➡️')
								.setDisabled(pages.length === 1)
								.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
								.setCustomId('search_add')
								.setStyle(ButtonStyle.Success)
								.setDisabled(true)
								.setLabel(await getGuildLocaleString(interaction.guildId, 'MISC.ADD')),
							new ButtonBuilder()
								.setCustomId('cancel')
								.setStyle(ButtonStyle.Secondary)
								.setLabel(await getGuildLocaleString(interaction.guildId, 'MISC.CANCEL')),
						),
				],
				fetchReply: true,
			},
		);
		searchState[msg.id] = {};
		searchState[msg.id].pages = pages;
		searchState[msg.id].timeout = setTimeout(async message => {
			try {
				await message.edit(
					buildMessageOptions(
						new EmbedBuilder()
							.setDescription(await getGuildLocaleString(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
						{ components: [] },
					),
				);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			}
			delete searchState[message.id];
		}, 30 * 1000, msg);
		searchState[msg.id].selected = [];
	},
};
