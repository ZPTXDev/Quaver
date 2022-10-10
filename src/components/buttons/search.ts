import PlayerHandler from '#src/lib/PlayerHandler.js';
import type { QuaverChannels, QuaverInteraction, QuaverPlayer } from '#src/lib/util/common.d.js';
import { logger, searchState } from '#src/lib/util/common.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, getGuildLocaleString, msToTime, msToTimeString } from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/queue';
import type { APISelectMenuOption, ButtonComponent, ButtonInteraction, MessageActionRowComponentBuilder, SelectMenuComponent } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ChannelType, EmbedBuilder, escapeMarkdown, GuildMember, PermissionsBitField, SelectMenuBuilder } from 'discord.js';

export default {
	name: 'search',
	async execute(interaction: QuaverInteraction<ButtonInteraction>): Promise<void> {
		if (interaction.message.interaction.user.id !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
			return;
		}
		const state = searchState[interaction.message.id];
		if (!state) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { components: [], force: 'update' });
			return;
		}
		const target = interaction.customId.split('_')[1];
		if (target === 'add') {
			const { bot, io } = await import('#src/main.js');
			const tracks = state.selected;
			let player = interaction.client.music.players.get(interaction.guildId) as QuaverPlayer;
			if (!(interaction.member instanceof GuildMember) || !interaction.member?.voice.channelId) {
				await interaction.replyHandler.locale(checks.IN_VOICE, { type: 'error' });
				return;
			}
			if (player && interaction.member?.voice.channelId !== player.channelId) {
				await interaction.replyHandler.locale(checks.IN_SESSION_VOICE, { type: 'error' });
				return;
			}
			// check for connect, speak permission for channel
			const permissions = interaction.member?.voice.channel.permissionsFor(interaction.client.user.id);
			if (!permissions.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) {
				await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC', { type: 'error' });
				return;
			}
			if (interaction.member?.voice.channel.type === ChannelType.GuildStageVoice && !permissions.has(PermissionsBitField.StageModerator)) {
				await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE', { type: 'error' });
				return;
			}
			let me = await interaction.guild.members.fetchMe();
			if (me.isCommunicationDisabled()) {
				await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { type: 'error' });
				return;
			}
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
				extras = [resolvedTracks.length.toString(), await getGuildLocaleString(interaction.guildId, 'MISC.YOUR_SEARCH'), ''] ;
			}
			if (!player?.connected) {
				player = interaction.client.music.createPlayer(interaction.guildId) as QuaverPlayer;
				player.handler = new PlayerHandler(interaction.client, player);
				player.queue.channel = interaction.channel as QuaverChannels;
				await player.connect(interaction.member.voice.channelId, { deafened: true });
				// Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
				// Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
				// Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
				me = await interaction.guild.members.fetchMe();
				const timedOut = me.isCommunicationDisabled();
				if (!interaction.member.voice.channelId || timedOut || !interaction.guild) {
					if (interaction.guild) timedOut ? await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { type: 'error', components: [] }) : await interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', { vars: [interaction.user.id], components: [] });
					return player.handler.disconnect();
				}
			}
			const firstPosition = player.queue.tracks.length + 1;
			const endPosition = firstPosition + resolvedTracks.length - 1;
			player.queue.add(resolvedTracks, { requester: interaction.user.id });
			const started = player.playing || player.paused;
			await interaction.replyHandler.reply(
				new EmbedBuilder()
					.setDescription(await getGuildLocaleString(interaction.guildId, msg, ...extras))
					.setFooter({ text: started ? `${await getGuildLocaleString(interaction.guildId, 'MISC.POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : null }),
				{ type: 'success', components: [] },
			);
			if (!started) await player.queue.start();
			if (settings.features.web.enabled) {
				io.to(`guild:${interaction.guildId}`).emit('queueUpdate', player.queue.tracks.map((track: Song & { requesterTag: string }): Song & { requesterTag: string } => {
					track.requesterTag = bot.users.cache.get(track.requester)?.tag;
					return track;
				}));
			}
			delete searchState[interaction.message.id];
			return;
		}
		const page = parseInt(target);
		clearTimeout(state.timeout);
		state.timeout = setTimeout(async (message): Promise<void> => {
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
		}, 30 * 1000, interaction.message);
		const pages = state.pages;
		const firstIndex = 10 * (page - 1) + 1;
		const pageSize = pages[page - 1].length;
		const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
		const original = { embeds: interaction.message.embeds, components: interaction.message.components };
		if (original.embeds.length === 0) {
			await interaction.message.delete();
			return;
		}
		const updated: { embeds: EmbedBuilder[], components: ActionRowBuilder<MessageActionRowComponentBuilder>[] } = { embeds: [], components: [] };
		updated.embeds[0] = EmbedBuilder.from(original.embeds[0])
			.setDescription(pages[page - 1].map((track: { info: Song }, index: number): string => {
				const duration = msToTime(track.info.length);
				const durationString = track.info.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${escapeMarkdown(track.info.title)}](${track.info.uri})** \`[${durationString}]\``;
			}).join('\n'))
			.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MISC.PAGE', page.toString(), pages.length.toString()) });
		updated.components[0] = <ActionRowBuilder<SelectMenuBuilder>> ActionRowBuilder.from(original.components[0]);
		updated.components[1] = <ActionRowBuilder<ButtonBuilder>> ActionRowBuilder.from(original.components[1]);
		const selectComponent = SelectMenuBuilder.from(<SelectMenuComponent> original.components[0].components[0])
			.setOptions(
				pages[page - 1]
					.map((track: { info: Song }, index: number): APISelectMenuOption => {
						let label = `${firstIndex + index}. ${track.info.title}`;
						if (label.length >= 100) label = `${label.substring(0, 97)}...`;
						return { label: label, description: track.info.author, value: track.info.identifier, default: !!state.selected.find((identifier: string): boolean => identifier === track.info.identifier) };
					})
					.concat(
						state.selected
							.map((identifier: string): APISelectMenuOption => {
								const refPg = pages.indexOf(
									pages.find((pg: { info: Song }[]): { info: Song } =>
										pg.find((t: { info: Song }): boolean => t.info.identifier === identifier),
									),
								);
								const firstIdx = 10 * refPg + 1;
								const refTrack = pages[refPg].find((t: { info: Song }): boolean => t.info.identifier === identifier);
								let label = `${firstIdx + pages[refPg].indexOf(refTrack)}. ${refTrack.info.title}`;
								if (label.length >= 100) label = `${label.substring(0, 97)}...`;
								return { label: label, description: refTrack.info.author, value: identifier, default: true };
							})
							.filter((options): boolean => !pages[page - 1].find((track: { info: Song }): boolean => track.info.identifier === options.value)),
					)
					.sort((a, b): number => parseInt(a.label.split('.')[0]) - parseInt(b.label.split('.')[0])),
			);
		// this code probably doesn't even do anything?
		selectComponent.setMaxValues(selectComponent.options.length);
		updated.components[0].components[0] = selectComponent;
		updated.components[1].components[0] = ButtonBuilder.from(<ButtonComponent> original.components[1].components[0])
			.setCustomId(`search_${page - 1}`)
			.setDisabled(page - 1 < 1);
		updated.components[1].components[1] = ButtonBuilder.from(<ButtonComponent> original.components[1].components[1])
			.setCustomId(`search_${page + 1}`)
			.setDisabled(page + 1 > pages.length);
		await interaction.replyHandler.reply(updated.embeds, { components: updated.components, force: 'update' });
	},
};
