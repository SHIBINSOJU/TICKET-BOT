const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const { TOKEN, CLIENT_ID, MONGO_URI } = process.env;

// --- MAIN LOGIC ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- COMMAND HANDLER SETUP ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// --- DEPLOYMENT LOGIC (RUNS ONLY WITH 'deploy' ARGUMENT) ---
const deployCommands = async () => {
    const commands = [];
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        commands.push(command.data.toJSON());
    }
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);
        // We use 'put' to refresh all commands globally
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log(`✅ Successfully reloaded ${commands.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
};

// --- DATABASE AND BOT STARTUP ---
const startBot = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB.');

        client.once(Events.ClientReady, c => {
            console.log(`🤖 Ready! Logged in as ${c.user.tag}`);
        });

        // Command Execution Listener
        client.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isChatInputCommand()) return;
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        });
        
        // Dynamic Button Interaction Listener
        client.on(Events.InteractionCreate, require('./src/events/buttonHandler'));

        client.login(TOKEN);
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB.', error);
        process.exit(1);
    }
};

// --- SCRIPT EXECUTION ROUTER ---
// This checks if you ran "node index.js deploy"
if (process.argv[2] === 'deploy') {
    deployCommands();
} else {
    startBot();
}
