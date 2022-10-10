import { logger, searchState } from '#src/lib/util/common.js';
import type { QuaverInteraction } from '#src/lib/util/common.types.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, getGuildLocaleString, getLocaleString, msToTime, msToTimeString, paginate } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction, SelectMenuComponentOptionData, SlashCommandStringOption } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, escapeMarkdown, Message, SelectMenuBuilder, SlashCommandBuilder } from 'discord.js';

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts
export default {
	data: new SlashCommandBuilder()
		.setName('search')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.SEARCH.DESCRIPTION'))
		.addStringOption((option): SlashCommandStringOption =>
			option
				.setName('query')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.SEARCH.OPTION.QUERY'))
				.setRequired(true)
				.setAutocomplete(true)),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: QuaverInteraction<ChatInputCommandInteraction>): Promise<void> {
		if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(interaction.channel.type)) {
			await interaction.replyHandler.locale('DISCORD.CHANNEL_UNSUPPORTED', { type: 'error' });
			return;
		}
		await interaction.deferReply();
		const query = interaction.options.getString('query');
		// this should be Track[] but lavaclient doesn't export it so
		// we should be using ReturnType<typeof x> but can't seem to
		// figure it out rn so we'll deal with this in subsequent
		// commits
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let tracks: any[] = [];
		const results = await interaction.client.music.rest.loadTracks(`ytsearch:${query}`);
		if (results.loadType === 'SEARCH_RESULT') tracks = results.tracks;
		if (tracks.length <= 1) {
			await interaction.replyHandler.locale('CMD.SEARCH.RESPONSE.USE_PLAY_CMD', { type: 'error' });
			return;
		}
		const pages = paginate(tracks, 10);
		const msg = await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(
					pages[0].map((track, index): string => {
						const duration = msToTime(track.info.length);
						const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${(index + 1).toString().padStart(tracks.length.toString().length, ' ')}.\` **[${escapeMarkdown(track.info.title)}](${track.info.uri})** \`[${durationString}]\``;
					}).join('\n'),
				)
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.PAGE', '1', pages.length.toString()) }),
			{
				components: [
					new ActionRowBuilder<SelectMenuBuilder>()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('search')
								.setPlaceholder(await getGuildLocaleString(interaction.guildId, 'CMD.SEARCH.MISC.PICK'))
								.addOptions(pages[0].map((track, index): SelectMenuComponentOptionData => {
									let label = `${index + 1}. ${track.info.title}`;
									if (label.length >= 100) label = `${label.substring(0, 97)}...`;
									return { label: label, description: track.info.author, value: track.info.identifier };
								}))
								.setMinValues(0)
								.setMaxValues(pages[0].length),
						),
					new ActionRowBuilder<ButtonBuilder>()
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
		if (!(msg instanceof Message)) return;
		searchState[msg.id] = {
			pages: pages,
			timeout: setTimeout(async (message): Promise<void> => {
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
			}, 30 * 1000, msg),
			selected: [],
		};
	},
};
