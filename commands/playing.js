const { SlashCommandBuilder } = require('@discordjs/builders');
const { LoopType } = require('@lavaclient/queue');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { getBar, msToTime, msToTimeString } = require('../functions.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('playing')
		.setDescription(getLocale(defaultLocale, 'CMD_PLAYING_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		// workaround: seems like current track doesn't get removed after the track, an issue with @lavaclient/queue
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.replyHandler.localeErrorReply('MUSIC_QUEUE_NOT_PLAYING');
			return;
		}
		const bar = getBar((player.accuratePosition / player.queue.current.length) * 100);
		let elapsed = msToTime(player.accuratePosition);
		if (isNaN(elapsed['s']) || elapsed['s'] < 0) {
			elapsed = { d: 0, h: 0, m: 0, s: 0 };
		}
		const elapsedString = msToTimeString(elapsed, true);
		const duration = msToTime(player.queue.current.length);
		const durationString = msToTimeString(duration, true);
		if (player.queue.current.isStream) {
			// i'm not touching this
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})**\n🔴 **${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_LIVE')}** ${'▬'.repeat(10)}${player.paused ? ' ⏸️' : ''}${player.queue.loop.type !== LoopType.None ? ` ${player.queue.loop.type === LoopType.Queue ? '🔁' : '🔂'}` : ''}${player.bassboost ? ' 🅱️' : ''}\n\`[${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_STREAMING')}]\` | ${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_ADDED_BY', player.queue.current.requester)}`)
						.setColor(defaultColor),
				],
			});
			return;
		}
		// nor this
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`**[${player.queue.current.title}](${player.queue.current.uri})**\n${bar}${player.paused ? ' ⏸️' : ''}${player.queue.loop.type !== LoopType.None ? ` ${player.queue.loop.type === LoopType.Queue ? '🔁' : '🔂'}` : ''}${player.bassboost ? ' 🅱️' : ''}${player.nightcore ? ' 🇳' : ''}\n\`[${elapsedString} / ${durationString}]\` | ${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_ADDED_BY', player.queue.current.requester)}`)
					.setColor(defaultColor),
			],
		});
	},
};
