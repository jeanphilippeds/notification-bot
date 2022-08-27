import { REST } from '@discordjs/rest';
import { Routes, SlashCommandBuilder } from 'discord.js';
import { APPLICATION_ID, BOT_TOKEN, COMMANDS, GUILD_ID } from '../config.js';

const commands = [
	new SlashCommandBuilder()
		.setName(COMMANDS.activate.commandName)
		.setDescription(COMMANDS.activate.helpText),
	new SlashCommandBuilder()
		.setName(COMMANDS.deactivate.commandName)
		.setDescription(COMMANDS.deactivate.helpText),
	new SlashCommandBuilder()
		.setName(COMMANDS.carpool.commandName)
		.setDescription(COMMANDS.carpool.helpText)
		.addIntegerOption((option) =>
			option
				.setName(COMMANDS.carpool.numberOfSeatsOption)
				.setDescription('Nombre de places disponibles en plus du conducteur')
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(8),
		),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

rest.put(Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);
