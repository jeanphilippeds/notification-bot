# DUCK DISCORD BOT

## Usage

This bot has 2 main features:

### 1. `Carpool` to simplify organization of carpool inside DISCORD.

The code here will handle:
- The registration of a new command `/covoit`
- The user interactions with the bot messages:
   - create a carpool session
   - reserve/free a seat
   - cancel a carpool session

### 2. `Channel toggle` to allow users to opt-in only the channels they want to follow.

The code here will handle:
- The registration of 2 new commands `/activer-suivi-sorties` and `/desactiver-suivi-sorties`
- The user interactions for `opt-in` and `opt-out`, i.e. to show/hide a certain channel.


## Code structure

The first file to be used is `commands/register-commands.js` that registers the commands in the Discord server.

Then, all behiavours are managed in `bot.js`.

Note1: It is possible to enable or not the 2 features independently.

Note2: To run the code locally, create an `.env` file at the root. Fill it following `.env.template`

## Deployment

The bot is currently deployed on AWS with `Cloudformation`. The corresponding template is in `stack.yml`

To deploy it, you'll need the `aws-cli` and:
- Go to AWS console and create a secret in SecretsManager to store the Discord Bot Token (see [Discord dev portal](https://discord.com/developers/applications))
- Before running the following command, check its parameters in `stack.yml`, especially `GithubRepository` and `BotTokenSecretPath`
- Run `aws cloudformation deploy --template-file stack.yml --stack-name discord-bot --capabilities CAPABILITY_IAM`. Use `--parameters` to override the default values.
- Go to AWS console and activate Github connection in CodePipeline > Settings > Connections


## Add the bot to a guild

- Ask admin to go here: https://discord.com/api/oauth2/authorize?client_id=1002520014512984124&permissions=2048&scope=bot%20applications.commands
- Update .env values
- Register commands with `node commands/register-command.js`