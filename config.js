import { ButtonBuilder, ButtonStyle } from 'discord.js';
import 'dotenv/config';

export const getEnvKeyOrThrow = key => {
	const value = process.env[key];

	if (!process.env[key]) {
		throw new Error(`${key} was not found (or is empty) in process.env`);
	}
	return value;
};

export const getShowButton = channelId => new ButtonBuilder()
	.setCustomId(`show:${channelId}`)
	.setLabel('Suivre la sortie')
	.setStyle(ButtonStyle.Primary);

const getHideButton = channelId => new ButtonBuilder()
	.setCustomId(`hide:${channelId}`)
	.setLabel('Masquer la sortie')
	.setStyle(ButtonStyle.Secondary);

export const BUTTON_CONFIG = {
	show: {
		displayChannel: true,
		message: 'Le salon est désormais visible dans Sorties',
		getNextButton: getHideButton,
	},
	hide: {
		displayChannel: false,
		message: 'Le salon est masqué',
		getNextButton: getShowButton,
	},
};
export const COMMANDS = {
	activate: { commandName: 'activer-suivi-sorties', helpText: 'Permet de suivre uniquement les sorties que tu as choisies' },
	deactivate: { commandName: 'desactiver-suivi-sorties', helpText: 'Affiche toutes les sorties proposées' },
	carpool: { commandName: 'covoit', helpText: 'Permet de proposer une ou plusieurs places en voiture', numberOfSeatsOption: 'places_disponibles' },
};

export const MUTE_CATEGORY = getEnvKeyOrThrow('MUTE_CATEGORY');
export const GENERAL_CHANNEL = getEnvKeyOrThrow('GENERAL_CHANNEL');
export const CHANNEL_TOGGLE_ROLE_ID = getEnvKeyOrThrow('CHANNEL_TOGGLE_ROLE_ID');
export const BOT_TOKEN = getEnvKeyOrThrow('BOT_TOKEN');
export const APPLICATION_ID = getEnvKeyOrThrow('APPLICATION_ID');
export const GUILD_ID = getEnvKeyOrThrow('GUILD_ID');