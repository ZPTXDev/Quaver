const { MessageEmbed } = require('discord.js');
const { guildData, logger } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { bot } = require('../main.js');
const { defaultLocale, defaultColor } = require('../settings.json');

module.exports = class MusicHandler {
	constructor(player) {
		this.player = player;
	}

	disconnect() {
		clearTimeout(this.player.timeout);
		clearTimeout(this.player.pauseTimeout);
		this.player.disconnect();
		this.player.destroy();
	}

	sendDataConstructor(data, embedExtras, error) {
		const sendData = {
			embeds: [
				new MessageEmbed()
					.setTitle(embedExtras?.title ?? '')
					.setDescription(data)
					.setFooter({ text: embedExtras?.footer ?? '' })
					.setThumbnail(embedExtras?.thumbnail ?? '')
					.setColor(error ? 'DARK_RED' : defaultColor),
				...embedExtras?.additionalEmbeds ?? [],
			],
		};
		if (embedExtras?.components) sendData.components = embedExtras.components;
		return sendData;
	}

	send(data, embedExtras, error) {
		const sendData = this.sendDataConstructor(data, embedExtras, error);
		const channel = this.player.queue.channel;
		if (!channel.permissionsFor(bot.user.id).has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) {
			return false;
		}
		try {
			return channel.send(sendData);
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			return false;
		}
	}

	locale(code, embedExtras, error, ...args) {
		const localizedString = getLocale(guildData.get(`${this.player.guildId}.locale`) ?? defaultLocale, code, ...args);
		return this.send(localizedString, embedExtras, error);
	}
};
