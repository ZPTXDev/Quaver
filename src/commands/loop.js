import { SlashCommandBuilder } from 'discord.js';
import { LoopType } from '@lavaclient/queue';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('loop')
		.setDescription(getLocale(defaultLocale, 'CMD_LOOP_DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('type')
				.setDescription(getLocale(defaultLocale, 'CMD_LOOP_OPTION_TYPE'))
				.setRequired(true)
				.addChoices(
					{ name: getLocale(defaultLocale, 'CMD_LOOP_OPTION_TYPE_DISABLED'), value: 'disabled' },
					{ name: getLocale(defaultLocale, 'CMD_LOOP_OPTION_TYPE_TRACK'), value: 'track' },
					{ name: getLocale(defaultLocale, 'CMD_LOOP_OPTION_TYPE_QUEUE'), value: 'queue' },
				)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const type = interaction.options.getString('type');
		let loop, typeLocale;
		switch (type) {
			case 'disabled':
				loop = LoopType.None;
				typeLocale = getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD_LOOP_OPTION_TYPE_DISABLED');
				break;
			case 'track':
				loop = LoopType.Song;
				typeLocale = getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD_LOOP_OPTION_TYPE_TRACK');
				break;
			case 'queue':
				loop = LoopType.Queue;
				typeLocale = getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD_LOOP_OPTION_TYPE_QUEUE');
				break;
		}
		typeLocale = typeLocale.toLowerCase();
		player.queue.setLoop(loop);
		await interaction.replyHandler.locale('CMD_LOOP_SUCCESS', {}, 'neutral', typeLocale);
	},
};
