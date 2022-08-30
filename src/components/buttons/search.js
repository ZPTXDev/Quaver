import { ActionRowBuilder, ButtonBuilder, ChannelType, EmbedBuilder, escapeMarkdown, PermissionsBitField, SelectMenuBuilder } from 'discord.js';
import { getGuildLocale, messageDataBuilder, msToTime, msToTimeString } from '#lib/util/util.js';
import { searchState } from '#lib/util/common.js';
import { checks } from '#lib/util/constants.js';
import PlayerHandler from '#lib/PlayerHandler.js';
import { features } from '#settings';

export default {
	name: 'search',
	/** @param {import('discord.js').ButtonInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (interaction.message.interaction.user.id !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
		const state = searchState[interaction.message.id];
		if (!state) return interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { components: [], force: 'update' });
		let page = interaction.customId.split('_')[1];
		if (page === 'add') {
			const { bot, io } = await import('#src/main.js');
			const tracks = state.selected;
			let player = interaction.client.music.players.get(interaction.guildId);
			if (!interaction.member?.voice.channelId) return interaction.replyHandler.locale(checks.IN_VOICE, { type: 'error' });
			if (player && interaction.member?.voice.channelId !== player.channelId) return interaction.replyHandler.locale(checks.IN_SESSION_VOICE, { type: 'error' });
			// check for connect, speak permission for channel
			const permissions = interaction.member?.voice.channel.permissionsFor(interaction.client.user.id);
			if (!permissions.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) return interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC', { type: 'error' });
			if (interaction.member?.voice.channel.type === ChannelType.GuildStageVoice && !permissions.has(PermissionsBitField.StageModerator)) return interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE', { type: 'error' });
			if (interaction.guild.members.me.isCommunicationDisabled()) return interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { type: 'error' });

			clearTimeout(state.timeout);
			await interaction.replyHandler.locale('MISC.LOADING', { components: [], force: 'update' });
			const resolvedTracks = [];
			for (const track of tracks) {
				const results = await interaction.client.music.rest.loadTracks(track);
				if (results.loadType === 'TRACK_LOADED') resolvedTracks.push(results.tracks[0]);
			}
			let msg, extras = [];
			if (resolvedTracks.length === 1) {
				msg = 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
				extras = [escapeMarkdown(resolvedTracks[0].info.title), resolvedTracks[0].info.uri];
			}
			else {
				msg = 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
				extras = [resolvedTracks.length, await getGuildLocale(interaction.guildId, 'MISC.YOUR_SEARCH'), ''] ;
			}
			if (!player?.connected) {
				player = interaction.client.music.createPlayer(interaction.guildId);
				player.handler = new PlayerHandler(interaction.client, player);
				player.queue.channel = interaction.channel;
				await player.connect(interaction.member.voice.channelId, { deafened: true });
				// Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
				// Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
				// Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
				const timedOut = interaction.guild?.members.me.isCommunicationDisabled();
				if (!interaction.member.voice.channelId || timedOut || !interaction.guild) {
					if (interaction.guild) timedOut ? await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { type: 'error', components: [] }) : await interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', { args: [interaction.user.id], components: [] });
					return player.handler.disconnect();
				}
			}

			const firstPosition = player.queue.tracks.length + 1;
			const endPosition = firstPosition + resolvedTracks.length - 1;
			player.queue.add(resolvedTracks, { requester: interaction.user.id });

			const started = player.playing || player.paused;
			await interaction.replyHandler.reply(
				new EmbedBuilder()
					.setDescription(await getGuildLocale(interaction.guildId, msg, ...extras))
					.setFooter({ text: started ? `${await getGuildLocale(interaction.guildId, 'MISC.POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : null }),
				{ type: 'success', components: [] },
			);
			if (!started) await player.queue.start();
			if (features.web.enabled) {
				io.to(`guild:${interaction.guildId}`).emit('queueUpdate', player.queue.tracks.map(track => {
					track.requesterTag = bot.users.cache.get(track.requester)?.tag;
					return track;
				}));
			}
			delete searchState[interaction.message.id];
			return;
		}
		page = parseInt(page);
		clearTimeout(state.timeout);
		state.timeout = setTimeout(async message => {
			await message.edit(
				messageDataBuilder(
					new EmbedBuilder()
						.setDescription(await getGuildLocale(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
					{ components: [] },
				),
			);
			delete searchState[message.id];
		}, 30 * 1000, interaction.message);
		const pages = state.pages;
		const firstIndex = 10 * (page - 1) + 1;
		const pageSize = pages[page - 1].length;
		const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
		const original = { embeds: interaction.message.embeds, components: interaction.message.components };
		if (original.embeds.length === 0) return interaction.message.delete();
		original.embeds[0] = EmbedBuilder.from(original.embeds[0])
			.setDescription(pages[page - 1].map((track, index) => {
				const duration = msToTime(track.info.length);
				const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${escapeMarkdown(track.info.title)}](${track.info.uri})** \`[${durationString}]\``;
			}).join('\n'))
			.setFooter({ text: await getGuildLocale(interaction.guildId, 'MISC.PAGE', page, pages.length) });
		original.components[0] = ActionRowBuilder.from(original.components[0]);
		original.components[0].components[0] = SelectMenuBuilder.from(original.components[0].components[0])
			.setOptions(
				pages[page - 1]
					.map((track, index) => {
						let label = `${firstIndex + index}. ${track.info.title}`;
						if (label.length >= 100) label = `${label.substring(0, 97)}...`;
						return { label: label, description: track.info.author, value: track.info.identifier, default: !!state.selected.find(identifier => identifier === track.info.identifier) };
					})
					.concat(
						state.selected
							.map(identifier => {
								const refPg = pages.indexOf(pages.find(pg => pg.find(t => t.info.identifier === identifier)));
								const firstIdx = 10 * refPg + 1;
								const refTrack = pages[refPg].find(t => t.info.identifier === identifier);
								let label = `${firstIdx + pages[refPg].indexOf(refTrack)}. ${refTrack.info.title}`;
								if (label.length >= 100) label = `${label.substring(0, 97)}...`;
								return { label: label, description: refTrack.info.author, value: identifier, default: true };
							})
							.filter(options => !pages[page - 1].find(track => track.info.identifier === options.value)),
					)
					.sort((a, b) => parseInt(a.label.split('.')[0]) - parseInt(b.label.split('.')[0])),
			);
		original.components[0].components[0].setMaxValues(original.components[0].components[0].options.length);
		original.components[1] = ActionRowBuilder.from(original.components[1]);
		original.components[1].components[0] = ButtonBuilder.from(original.components[1].components[0])
			.setCustomId(`search_${page - 1}`)
			.setDisabled(page - 1 < 1);
		original.components[1].components[1] = ButtonBuilder.from(original.components[1].components[1])
			.setCustomId(`search_${page + 1}`)
			.setDisabled(page + 1 > pages.length);
		return interaction.replyHandler.reply(original.embeds, { components: original.components, force: 'update' });
	},
};
