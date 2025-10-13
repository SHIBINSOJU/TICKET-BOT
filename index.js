const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

// Ensure all required environment variables are present
const { TOKEN, CLIENT_ID, MONGO_URI } = process.env;
if (!TOKEN || !CLIENT_ID || !MONGO_URI) {
    console.error("❌ Error: TOKEN, CLIENT_ID, and MONGO_URI must be set in the .env file.");
    process.exit(1);
}
// Note: GUILD_ID is no longer required for the public version.

// --- MAIN LOGIC ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- COMMAND HANDLER SETUP ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('--- Loading Commands ---');
let commandsLoadedCount = 0;

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        // Log for each command loaded
        console.log(`[+] Loaded command: /${command.data.name}`);
        commandsLoadedCount++;
    } else {
        console.log(`[!] Warning: The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Summary log
console.log(`\n✅ Successfully loaded a total of ${commandsLoadedCount} command(s).`);
console.log('------------------------');


// --- DEPLOYMENT LOGIC (RUNS ONLY WITH 'deploy' ARGUMENT) ---
const deployCommands = async () => {
    const commands = [];
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        commands.push(command.data.toJSON());
    }

    if (commands.length === 0) {
        console.log('No commands found to deploy.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands globally.`);

        // 1. GLOBAL DEPLOYMENT (Required for public bots)
        // This makes commands available on all servers the bot joins.
        // NOTE: It can take up to one hour for commands to appear on servers.
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log(`✅ Successfully reloaded ${commands.length} application (/) commands globally.`);

        // 2. GUILD-SPECIFIC DEPLOYMENT (Commented out)
        // This is only for fast testing on a single server.
        /*
        const { GUILD_ID } = process.env;
        if (!GUILD_ID) return console.error("❌ Error: GUILD_ID is not set in the .env file for guild-specific deployment.");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log(`✅ Successfully reloaded ${commands.length} application (/) commands for the test guild.`);
        */

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
if (process.argv[2] === 'deploy') {
    deployCommands();
} else {
    startBot();
}
