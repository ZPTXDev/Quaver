import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { colors, defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale, msToTime, msToTimeString } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts

export default {
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
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(interaction.channel.type)) {
			await interaction.replyHandler.locale('DISCORD_BOT_UNSUPPORTED_CHANNEL', {}, 'error');
			return;
		}
		await interaction.deferReply();
		const query = interaction.options.getString('query');
		let tracks = [];

		const results = await interaction.client.music.rest.loadTracks(`ytsearch:${query}`);
		if (results.loadType === 'SEARCH_RESULT') tracks = results.tracks;

		tracks = tracks.slice(0, 10);
		if (tracks.length <= 1) {
			await interaction.replyHandler.locale('CMD_SEARCH_USE_PLAY_CMD', {}, 'error');
			return;
		}

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setDescription(tracks.map((track, index) => {
						const duration = msToTime(track.info.length);
						const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${(index + 1).toString().padStart(tracks.length.toString().length, ' ')}.\` **[${track.info.title}](${track.info.uri})** \`[${durationString}]\``;
					}).join('\n'))
					.setColor(colors.neutral),
			],
			components: [
				new ActionRowBuilder()
					.addComponents(
						new SelectMenuBuilder()
							.setCustomId(`play_${interaction.user.id}`)
							.setPlaceholder(getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD_SEARCH_PICK'))
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
				new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setCustomId(`cancel_${interaction.user.id}`)
							.setLabel(getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC_CANCEL'))
							.setStyle(ButtonStyle.Danger),
					),
			],
		});
	},
};
