import { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, SelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks, settingsOptions } from '#lib/util/constants.js';
import { getLocaleString, messageDataBuilder, getGuildLocaleString, settingsPage } from '#lib/util/util.js';
import { confirmationTimeout, data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('settings')
		.setDescription(getLocaleString(defaultLocale, 'CMD.SETTINGS.DESCRIPTION'))
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [PermissionsBitField.Flags.ManageGuild],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const option = settingsOptions[0];
		const guildLocale = await data.guild.get(interaction.guild.id, 'settings.locale') ?? defaultLocale;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocale, option);
		const description = `${getLocaleString(guildLocale, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`)}** ─ ${getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`)}\n> ${getLocaleString(guildLocale, 'MISC.CURRENT')}: \`${current}\``;
		const msg = await interaction.replyHandler.reply(
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('settings')
								.addOptions(
									settingsOptions.map(opt => ({ label: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`), description: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`), value: opt, default: opt === option })),
								),
						),
					actionRow,
				],
				fetchReply: true,
			},
		);
		confirmationTimeout[msg.id] = setTimeout(async message => {
			await message.edit(
				messageDataBuilder(
					new EmbedBuilder()
						.setDescription(await getGuildLocaleString(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
					{ components: [] },
				),
			);
			delete confirmationTimeout[message.id];
		}, 30 * 1000, msg);
	},
};
