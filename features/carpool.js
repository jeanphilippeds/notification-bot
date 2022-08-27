import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { COMMANDS } from '../config.js';
import { getMemberName } from '../helper.js';

const CARPOOL_MEMORY_MAP = {};
const FROM_INPUT_MODAL_ID = 'carpool-from-input';
const TIME_INPUT_MODAL_ID = 'carpool-time-input';
const TEXT_INPUT_MODAL_ID = 'carpool-text-input';

export const handleCarpoolCommand = async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName, id: interactionId } = interaction;

	if (COMMANDS.carpool.commandName !== commandName) return;

	const cacheKey = `carpool-${interactionId}`;

	const modal = new ModalBuilder()
		.setCustomId(cacheKey)
		.setTitle('Nouvelle voiture');

	const fromInput = new TextInputBuilder()
		.setCustomId(FROM_INPUT_MODAL_ID)
		.setLabel('Point de départ')
		.setStyle(TextInputStyle.Short);

	const timeInput = new TextInputBuilder()
		.setCustomId(TIME_INPUT_MODAL_ID)
		.setLabel('Heure de départ')
		.setStyle(TextInputStyle.Short);

	const textInput = new TextInputBuilder()
		.setCustomId(TEXT_INPUT_MODAL_ID)
		.setLabel('Commentaire')
		.setRequired(false)
		.setStyle(TextInputStyle.Short);

	const firstActionRow = new ActionRowBuilder().addComponents(fromInput);
	const secondActionRow = new ActionRowBuilder().addComponents(timeInput);
	const thirdActionRow = new ActionRowBuilder().addComponents(textInput);
	modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

	CARPOOL_MEMORY_MAP[cacheKey] = { numberOfSeats: interaction.options.getInteger(COMMANDS.carpool.numberOfSeatsOption) };
	await interaction.showModal(modal);
};

export const handleCarpoolModalSubmit = async (interaction) => {
	const { customId, user: { id: userId } } = interaction;

	if (!interaction.isModalSubmit()) return;
	if (!customId.startsWith('carpool-')) return;

	const inMemoryCarpool = CARPOOL_MEMORY_MAP[customId];
	if (!inMemoryCarpool) {
		await interaction.reply({ content: 'Oups! Merci de répéter la commande /covoit', ephemeral: true });
		return;
	}

	const user = await interaction.guild.members.fetch(userId);
	const fromInput = interaction.fields.getTextInputValue(FROM_INPUT_MODAL_ID);
	const timeInput = interaction.fields.getTextInputValue(TIME_INPUT_MODAL_ID);
	const textInput = interaction.fields.getTextInputValue(TEXT_INPUT_MODAL_ID);
	const comment = textInput ? `\nCommentaire: ${textInput}.` : '';
	const content = `${getMemberName(user)} vient de proposer un trajet depuis: "${fromInput}". RDV à ${timeInput}.${comment}`;

	const components = [...Array(inMemoryCarpool.numberOfSeats).keys()]
		.map(i => {
			return new ActionRowBuilder().addComponents(new ButtonBuilder()
				.setCustomId(`${customId}-${i}`)
				.setLabel('✅ Place disponible')
				.setStyle(ButtonStyle.Secondary),
			);
		});
	await interaction.reply({ content, components });
};