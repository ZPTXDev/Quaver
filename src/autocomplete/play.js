import { request } from 'undici';

export default {
	name: 'play',
	async execute(interaction) {
		const focused = interaction.options.getFocused();
		const { body } = await request(`https://clients1.google.com/complete/search?client=youtube&gs_ri=youtube&ds=yt&q=${focused}`);
		let data;
		try {
			data = await body.text();
			let searchSuggestions = [];
			data.split('[').forEach((ele, index) => {
				if (!ele.split('"')[1] || index === 1) return;
				return searchSuggestions.push(ele.split('"')[1]);
			});
			searchSuggestions.pop();
			searchSuggestions = searchSuggestions.filter(ele => ele !== focused);
			searchSuggestions.unshift(focused);
			return interaction.respond(
				searchSuggestions
					.filter(ele => ele !== '')
					.map(suggestion => suggestion.replace(/\\u([0-9a-fA-F]{4})/g, (whole, grp) => String.fromCharCode(parseInt(grp, 16))))
					.filter(suggestion => suggestion.length <= 100)
					.map(suggestion => ({ name: suggestion, value: suggestion })),
			);
		}
		catch (err) {
			return interaction.respond([]);
		}
	},
};
