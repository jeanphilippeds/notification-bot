import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { COMMANDS } from '../config.js';
import { getMemberName } from '../helper.js';

const TRY_AGAIN_REPLY = { content: 'Erreur! Merci de répéter la commande /covoit', ephemeral: true };

const CARPOOL_MEMORY_MAP = {};
const FROM_INPUT_MODAL_ID = 'carpool-from-input';
const TIME_INPUT_MODAL_ID = 'carpool-time-input';
const TEXT_INPUT_MODAL_ID = 'carpool-text-input';

const getButtonsRowFromMap = map => [
	...Object.entries(map)
		.map(([, { isAvailable, passengerName, buttonKey }]) => {
			return new ActionRowBuilder().addComponents(new ButtonBuilder()
				.setCustomId(buttonKey)
				.setLabel(isAvailable ? '✅ Place disponible' : `🐥 ${passengerName}`)
				.setStyle(isAvailable ? ButtonStyle.Primary : ButtonStyle.Secondary),
			);
		}),
	new ActionRowBuilder().addComponents(new ButtonBuilder()
		.setCustomId('button-carpool-remove')
		.setLabel('Supprimer la voiture')
		.setStyle(ButtonStyle.Danger)),
];

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

	CARPOOL_MEMORY_MAP[cacheKey] = [...Array(interaction.options.getInteger(COMMANDS.carpool.numberOfSeatsOption)).keys()]
		.reduce((acc, i) => {
			return { ...acc, [i]: { isAvailable: true, buttonKey: `button-${cacheKey}-${i}` } };
		}, {});
	await interaction.showModal(modal);
};

export const handleCarpoolModalSubmit = async (interaction) => {
	const { customId, member } = interaction;

	if (!interaction.isModalSubmit()) return;
	if (!customId || !customId.startsWith('carpool-')) return;

	if (!CARPOOL_MEMORY_MAP[customId]) {
		await interaction.reply(TRY_AGAIN_REPLY);
		return;
	}

	const fromInput = interaction.fields.getTextInputValue(FROM_INPUT_MODAL_ID);
	const timeInput = interaction.fields.getTextInputValue(TIME_INPUT_MODAL_ID);
	const textInput = interaction.fields.getTextInputValue(TEXT_INPUT_MODAL_ID);
	const comment = textInput ? `\nCommentaire: ${textInput}.` : '';
	const content = `${getMemberName(member)} vient de proposer un trajet depuis: "${fromInput}". RDV à ${timeInput}.${comment}`;

	await interaction.reply({
		content,
		components: getButtonsRowFromMap(CARPOOL_MEMORY_MAP[customId]),
	});
};

export const handleCarpoolButton = async (interaction) => {
	const { customId, member } = interaction;

	if (!customId || !customId.startsWith('button-carpool-')) return;

	if (customId === 'button-carpool-remove') {
		interaction.message.delete();
		return;
	}

	const match = customId.match(/^button-(carpool-\w*)-(\w*)$/);

	if (!match || !match[1] || !match[2]) {
		await interaction.reply(TRY_AGAIN_REPLY);
		return;
	}

	const cacheKey = match[1];
	const seatIndex = match[2];

	if (!CARPOOL_MEMORY_MAP[cacheKey]) {
		await interaction.reply(TRY_AGAIN_REPLY);
		return;
	}

	const { isAvailable, passengerMemberId, buttonKey } = CARPOOL_MEMORY_MAP[cacheKey][seatIndex];

	if (isAvailable) {
		CARPOOL_MEMORY_MAP[cacheKey][seatIndex] = {
			buttonKey,
			isAvailable: false,
			passengerName: getMemberName(member),
			passengerMemberId: member.id,
		};
	}

	if (!isAvailable && passengerMemberId === member.id) {
		CARPOOL_MEMORY_MAP[cacheKey][seatIndex] = {
			buttonKey,
			isAvailable: true,
		};
	}

	await interaction.update({
		components: getButtonsRowFromMap(CARPOOL_MEMORY_MAP[cacheKey]),
	});
};