import { SlashCommandBuilder } from 'discord.js';
import { LoopType } from '@lavaclient/queue';
import { defaultLocale, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('loop')
		.setDescription(getLocale(defaultLocale, 'CMD.LOOP.DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('type')
				.setDescription(getLocale(defaultLocale, 'CMD.LOOP.OPTION.TYPE.DESCRIPTION'))
				.setRequired(true)
				.addChoices(
					{ name: getLocale(defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.DISABLED'), value: 'disabled' },
					{ name: getLocale(defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.TRACK'), value: 'track' },
					{ name: getLocale(defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.QUEUE'), value: 'queue' },
				)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		const type = interaction.options.getString('type');
		let loop, typeLocale;
		switch (type) {
			case 'disabled':
				loop = LoopType.None;
				typeLocale = getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.DISABLED');
				break;
			case 'track':
				loop = LoopType.Song;
				typeLocale = getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.TRACK');
				break;
			case 'queue':
				loop = LoopType.Queue;
				typeLocale = getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD.LOOP.OPTION.TYPE.OPTION.QUEUE');
				break;
		}
		typeLocale = typeLocale.toLowerCase();
		player.queue.setLoop(loop);
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('loopUpdate', loop);
		await interaction.replyHandler.locale('CMD.LOOP.RESPONSE.SUCCESS', {}, 'neutral', typeLocale);
	},
};
