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
		.then(({ Item: { data } }) => data)
		.catch(() => {
			console.log(`Could not find cacheKey: ${cacheKey}`);
			return null;
		});
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

const getModal = (cacheKey, values) => {
	const modal = new ModalBuilder()
		.setCustomId(cacheKey)
		.setTitle('Nouvelle voiture');

	const rows = [];

	[
		{ id: SEATS_INPUT_MODAL_ID, label: 'Nombre de places disponibles', placeholder: '1' },
		{ id: FROM_INPUT_MODAL_ID, label: 'Point de départ', placeholder: 'Botanic Seyssins' },
		{ id: TIME_INPUT_MODAL_ID, label: 'Heure de départ', placeholder: '12h12' },
		{ id: TEXT_INPUT_MODAL_ID, label: 'Commentaire', placeholder: 'J\'ai une 207 rose fuschia' },
	].forEach(({ id, label, placeholder }) => {
		const input = new TextInputBuilder()
			.setCustomId(id)
			.setLabel(label)
			.setPlaceholder(placeholder)
			.setStyle(TextInputStyle.Short);

		values[id] && input.setValue(values[id]);

		rows.push(new ActionRowBuilder().addComponents(input));
	});

	modal.addComponents(...rows);

	return modal;
};

export const handleCarpoolCommand = async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName, id: interactionId } = interaction;

	if (COMMANDS.carpool.commandName !== commandName) return;

	const cacheKey = `carpool-${interactionId}`;

	await interaction.showModal(getModal(
		cacheKey,
		{ [SEATS_INPUT_MODAL_ID]: interaction.options.getInteger(COMMANDS.carpool.numberOfSeatsOption).toString() },
	));
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

	const storedCarpoolObject = await getStoredCarpool(customId);
	const isEditing = !!storedCarpoolObject;
	const seatsNumber = Number(seatsInput);

	if (isNaN(seatsNumber) || seatsNumber > 4) {
		throw new Error('Should enter a valid number');
	}

	const initialSeatsObject = [...Array(seatsNumber).keys()]
		.reduce((acc, i) => {
			return { ...acc, [i]: { isAvailable: true, buttonKey: `button-${customId}-${i}` } };
		}, {});

	const seats = isEditing
		? (Object.keys(storedCarpoolObject.seats).length === seatsNumber) ? storedCarpoolObject.seats : initialSeatsObject
		: initialSeatsObject;

	await setStoredCarpool(customId, {
		from: fromInput,
		timeInput: timeInput,
		textInput: textInput,
		ownerName: getMemberName(member),
		ownerId: member.id,
		seats,
	});

	console.log(`[CARPOOL] User "${getMemberName(member)}" updated ride ${customId} from "${fromInput}", at "${timeInput}".`);

	const interactionContent = {
		content,
		components: getButtonsRowFromMap(seats, customId),
	};

	await isEditing ? interaction.update(interactionContent) : interaction.reply(interactionContent);
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
		console.log(`[CARPOOL] User "${getMemberName(member)}" deleted ride: ${cacheKey}.`);
		return;
	}

	if (buttonType === EDIT_SUFFIX && memberIsOwner) {
		await interaction.showModal(getModal(
			cacheKey,
			{
				[FROM_INPUT_MODAL_ID]: storedCarpoolObject.from,
				[TEXT_INPUT_MODAL_ID]: storedCarpoolObject.textInput,
				[TIME_INPUT_MODAL_ID]: storedCarpoolObject.timeInput,
				[SEATS_INPUT_MODAL_ID]: Object.keys(storedCarpoolObject.seats).length.toString(),
			},
		));
		return;
	}

	if ([DELETE_SUFFIX, EDIT_SUFFIX].includes(buttonType)) {
		console.log(`[CARPOOL] User "${getMemberName(member)}" tried to edit/delete the ride ${cacheKey}`);
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