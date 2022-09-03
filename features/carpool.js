import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { createClient } from 'redis';
import { COMMANDS, getEnvKeyOrThrow } from '../config.js';
import { getMemberName } from '../helper.js';

const TRY_AGAIN_REPLY = { content: 'Erreur! Merci de répéter la commande /covoit', ephemeral: true };

const FROM_INPUT_MODAL_ID = 'carpool-from-input';
const TIME_INPUT_MODAL_ID = 'carpool-time-input';
const TEXT_INPUT_MODAL_ID = 'carpool-text-input';

const redisClient = createClient({
	url: getEnvKeyOrThrow('REDISCLOUD_URL'),
});

redisClient.connect();

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

	const { commandName, id: interactionId, member } = interaction;

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

	const initialSeatsObject = [...Array(interaction.options.getInteger(COMMANDS.carpool.numberOfSeatsOption)).keys()]
		.reduce((acc, i) => {
			return { ...acc, [i]: { isAvailable: true, buttonKey: `button-${cacheKey}-${i}` } };
		}, {});

	await redisClient.set(cacheKey, JSON.stringify(initialSeatsObject));
	await redisClient.expire(cacheKey, 60 * 60 * 24 * 30); // Expire after 1 month
	console.log(`[CARPOOL] User "${getMemberName(member)}" started ride ${cacheKey}.`);
	await interaction.showModal(modal);
};

export const handleCarpoolModalSubmit = async (interaction) => {
	const { customId, member } = interaction;

	if (!interaction.isModalSubmit()) return;
	if (!customId || !customId.startsWith('carpool-')) return;

	const storedSeats = await redisClient.get(customId);

	if (!storedSeats) {
		console.log(`[CARPOOL] User "${getMemberName(member)}" answered modal on ${customId} but no corresponding entry found.`);
		await interaction.reply(TRY_AGAIN_REPLY);
		return;
	}

	const fromInput = interaction.fields.getTextInputValue(FROM_INPUT_MODAL_ID);
	const timeInput = interaction.fields.getTextInputValue(TIME_INPUT_MODAL_ID);
	const textInput = interaction.fields.getTextInputValue(TEXT_INPUT_MODAL_ID);
	const comment = textInput ? `\nCommentaire: ${textInput}.` : '';
	const content = `${getMemberName(member)} vient de proposer un trajet depuis: "${fromInput}". RDV à ${timeInput}.${comment}`;

	console.log(`[CARPOOL] User "${getMemberName(member)}" created ride ${customId} from "${fromInput}", at "${timeInput}"`);
	await interaction.reply({
		content,
		components: getButtonsRowFromMap(JSON.parse(storedSeats)),
	});
};

export const handleCarpoolButton = async (interaction) => {
	const { customId, member } = interaction;

	if (!customId || !customId.startsWith('button-carpool-')) return;

	if (customId === 'button-carpool-remove') {
		interaction.message.delete();
		console.log(`[CARPOOL] User "${getMemberName(member)}" deleted carpool: ${interaction.message.content}`);
		return;
	}

	const match = customId.match(/^button-(carpool-\w*)-(\w*)$/);

	// CLICK ON AN OTHER BUTTON
	if (!match || !match[1] || !match[2]) {
		return;
	}

	const cacheKey = match[1];
	const seatIndex = match[2];
	const storedSeatsObject = await redisClient.get(customId);

	if (!storedSeatsObject) {
		console.log(`[CARPOOL] User "${getMemberName(member)}" clicked on ${customId} but no corresponding entry found.`);
		await interaction.reply(TRY_AGAIN_REPLY);
		return;
	}

	const updatedSeatsObjects = JSON.parse(storedSeatsObject);
	const { isAvailable, passengerMemberId, buttonKey } = updatedSeatsObjects[seatIndex];

	if (isAvailable) {
		updatedSeatsObjects[seatIndex] = {
			buttonKey,
			isAvailable: false,
			passengerName: getMemberName(member),
			passengerMemberId: member.id,
		};
		console.log(`[CARPOOL] User "${getMemberName(member)}" reserved seat n°${seatIndex} on ride ${cacheKey}.`);
	}

	if (!isAvailable && passengerMemberId === member.id) {
		updatedSeatsObjects[seatIndex] = {
			buttonKey,
			isAvailable: true,
		};
		console.log(`[CARPOOL] User "${getMemberName(member)}" freed seat n°${seatIndex} on ride ${cacheKey}.`);
	}

	await redisClient.set(cacheKey, JSON.stringify(updatedSeatsObjects));

	await interaction.update({
		components: getButtonsRowFromMap(updatedSeatsObjects),
	});
};