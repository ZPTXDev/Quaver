import fs from 'fs';
import { getAbsoluteFileURL } from '#lib/util/util.js';
import { languageName } from '#lib/util/constants.js';

export default {
	name: 'language',
	async execute(interaction) {
		const focused = interaction.options.getFocused();
		return interaction.respond(
			fs.readdirSync(getAbsoluteFileURL(import.meta.url, ['..', '..', 'locales']))
				.map(file => { return { name: `${languageName[file] ?? 'Unknown'} (${file})`, value: file }; })
				.filter(file => file.value.toLowerCase().startsWith(focused.toLowerCase())),
		);
	},
};
