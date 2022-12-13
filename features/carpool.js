import AWS from 'aws-sdk';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { COMMANDS, getEnvKeyOrThrow } from '../config.js';

import { getMemberName } from '../helper.js';

const TRY_AGAIN_REPLY = { content: 'Erreur! Merci de répéter la commande /covoit', ephemeral: true };

const FROM_INPUT_MODAL_ID = 'carpool-from-input';
const TIME_INPUT_MODAL_ID = 'carpool-time-input';
const TEXT_INPUT_MODAL_ID = 'carpool-text-input';
const SEATS_INPUT_MODAL_ID = 'carpool-text-seats';

const DELETE_SUFFIX = 'delete';
const EDIT_SUFFIX = 'edit';

const ddb = new AWS.DynamoDB.DocumentClient({ region: getEnvKeyOrThrow('AWS_REGION') });

const getStoredCarpool = async (cacheKey) => {
	return await ddb
		.get({
			TableName: getEnvKeyOrThrow('AWS_DYNAMO_TABLE'),
			Key: { cacheKey },
		})
		.promise()
		.then(({ Item: { data } }) => data);
};

const setStoredCarpool = async (cacheKey, carpoolObject) => {
	const today = new Date();
	await ddb
		.put({
			TableName: getEnvKeyOrThrow('AWS_DYNAMO_TABLE'),
			Item: {
				cacheKey,
				data: carpoolObject,
				ttl: today.setMonth(today.getMonth() + 1),
			},
		})
		.promise();
};

const getButtonsRowFromMap = (map, cacheKey) => [
	...Object.entries(map)
		.map(([, { isAvailable, passengerName, buttonKey }]) => {
			return new ActionRowBuilder().addComponents(new ButtonBuilder()
				.setCustomId(buttonKey)
				.setLabel(isAvailable ? '✅ Place disponible' : `🐥 ${passengerName}`)
				.setStyle(isAvailable ? ButtonStyle.Primary : ButtonStyle.Secondary),
			);
		}),
	new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`button-${cacheKey}-${EDIT_SUFFIX}`)
			.setLabel('Editer')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId(`button-${cacheKey}-${DELETE_SUFFIX}`)
			.setLabel('Annuler')
			.setStyle(ButtonStyle.Danger),
	),
];

export const handleCarpoolCommand = async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName, id: interactionId } = interaction;

	if (COMMANDS.carpool.commandName !== commandName) return;

	const cacheKey = `carpool-${interactionId}`;

	const modal = new ModalBuilder()
		.setCustomId(cacheKey)
		.setTitle('Nouvelle voiture');

	const seatsInput = new TextInputBuilder()
		.setCustomId(SEATS_INPUT_MODAL_ID)
		.setLabel('Nombre de places disponibles')
		.setValue(interaction.options.getInteger(COMMANDS.carpool.numberOfSeatsOption).toString())
		.setStyle(TextInputStyle.Short);

	const fromInput = new TextInputBuilder()
		.setCustomId(FROM_INPUT_MODAL_ID)
		.setLabel('Point de départ')
		.setPlaceholder('Botanic Seyssins')
		.setStyle(TextInputStyle.Short);

	const timeInput = new TextInputBuilder()
		.setCustomId(TIME_INPUT_MODAL_ID)
		.setLabel('Heure de départ')
		.setPlaceholder('12h12')
		.setStyle(TextInputStyle.Short);

	const textInput = new TextInputBuilder()
		.setCustomId(TEXT_INPUT_MODAL_ID)
		.setLabel('Commentaire')
		.setPlaceholder('J\'ai une 207 rose fuschia')
		.setRequired(false)
		.setStyle(TextInputStyle.Short);

	const firstActionRow = new ActionRowBuilder().addComponents(seatsInput);
	const secondActionRow = new ActionRowBuilder().addComponents(fromInput);
	const thirdActionRow = new ActionRowBuilder().addComponents(timeInput);
	const fourthActionRow = new ActionRowBuilder().addComponents(textInput);
	modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

	await interaction.showModal(modal);
};

export const handleCarpoolModalSubmit = async (interaction) => {
	const { customId, member } = interaction;

	if (!interaction.isModalSubmit()) return;
	if (!customId || !customId.startsWith('carpool-')) return;

	const fromInput = interaction.fields.getTextInputValue(FROM_INPUT_MODAL_ID);
	const timeInput = interaction.fields.getTextInputValue(TIME_INPUT_MODAL_ID);
	const textInput = interaction.fields.getTextInputValue(TEXT_INPUT_MODAL_ID);
	const seatsInput = interaction.fields.getTextInputValue(SEATS_INPUT_MODAL_ID);

	const comment = textInput ? `\nCommentaire: ${textInput}.` : '';
	const content = `${getMemberName(member)} vient de proposer un trajet depuis: "${fromInput}". RDV à ${timeInput}.${comment}`;

	const initialSeatsObject = [...Array(Number(seatsInput)).keys()]
		.reduce((acc, i) => {
			return { ...acc, [i]: { isAvailable: true, buttonKey: `button-${customId}-${i}` } };
		}, {});

	await setStoredCarpool(customId, {
		from: fromInput,
		timeInput: timeInput,
		textInput: textInput,
		ownerName: getMemberName(member),
		ownerId: member.id,
		seats: initialSeatsObject,
	});

	console.log(`[CARPOOL] User "${getMemberName(member)}" created ride ${customId} from "${fromInput}", at "${timeInput}"`);
	await interaction.reply({
		content,
		components: getButtonsRowFromMap(initialSeatsObject, customId),
	});
};

export const handleCarpoolButton = async (interaction) => {
	const { customId, member } = interaction;

	if (!customId || !customId.startsWith('button-carpool-')) return;

	const match = customId.match(/^button-(carpool-\w*)-(\w*)$/);

	// CLICK ON AN OTHER BUTTON
	if (!match || !match[1] || !match[2]) {
		return;
	}

	const cacheKey = match[1];
	const buttonType = match[2];
	const seatIndex = match[2];
	const storedCarpoolObject = await getStoredCarpool(cacheKey);
	const memberIsOwner = member.id === storedCarpoolObject.ownerId;

	if (!storedCarpoolObject) {
		console.log(`[CARPOOL] User "${getMemberName(member)}" clicked on ${customId} but no corresponding entry found.`);
		await interaction.reply(TRY_AGAIN_REPLY);
		return;
	}

	if (buttonType === DELETE_SUFFIX && memberIsOwner) {
		interaction.message.delete();
		console.log(`[CARPOOL] User "${getMemberName(member)}" deleted carpool: ${interaction.message.content}`);
		return;
	}

	if ([DELETE_SUFFIX, EDIT_SUFFIX].includes(buttonType)) {
		await interaction.deferUpdate();
		return;
	}

	const { isAvailable, passengerMemberId, buttonKey } = storedCarpoolObject.seats[seatIndex];
	let seatToUpdate;

	if (isAvailable) {
		seatToUpdate = {
			buttonKey,
			isAvailable: false,
			passengerName: getMemberName(member),
			passengerMemberId: member.id,
		};
		console.log(`[CARPOOL] User "${getMemberName(member)}" reserved seat n°${seatIndex} on ride ${cacheKey}.`);
	}

	if (!isAvailable && passengerMemberId === member.id) {
		seatToUpdate = {
			buttonKey,
			isAvailable: true,
		};
		console.log(`[CARPOOL] User "${getMemberName(member)}" freed seat n°${seatIndex} on ride ${cacheKey}.`);
	}

	if (!seatToUpdate) {
		await interaction.deferUpdate();
		return;
	}

	const updatedCarpoolObject = {
		...storedCarpoolObject,
		seats: {
			...storedCarpoolObject.seats,
			[seatIndex]: seatToUpdate,
		},
	};

	await setStoredCarpool(cacheKey, updatedCarpoolObject);

	await interaction.update({
		components: getButtonsRowFromMap(updatedCarpoolObject.seats, cacheKey),
	});
};