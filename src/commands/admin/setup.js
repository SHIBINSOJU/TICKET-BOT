const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets up the role-assignment message with dynamic buttons.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the role message to.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('buttons')
                .setDescription('Define buttons like: Label1:@Role1, Label2:@Role2')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message content to display above the buttons (e.g., "Get your roles!").')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const buttonsDefinition = interaction.options.getString('buttons');
        const messageContent = interaction.options.getString('message');

        const buttonParts = buttonsDefinition.split(',').map(p => p.trim());

        if (buttonParts.length > 5) {
            return interaction.editReply('❌ You can only define a maximum of 5 buttons per row.');
        }

        const buttonCategories = [];
        const actionRow = new ActionRowBuilder();

        for (const part of buttonParts) {
            // Regex to match the label and the role mention (e.g., "Gamer:<@&12345>")
            const match = part.match(/([^:]+):<@&(\d+)>/);
            if (!match) {
                return interaction.editReply(`❌ Invalid format for button definition: "${part}". Please use \`Label:@Role\`.`);
            }

            const label = match[1].trim();
            const roleId = match[2];
            const role = await interaction.guild.roles.fetch(roleId);

            if (!role) {
                return interaction.editReply(`❌ The role for "${label}" could not be found.`);
            }

            // Add the validated data to our array for the database
            buttonCategories.push({ label, roleId });

            // Create the button for the message
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`role-button:${roleId}`) // Unique ID format we can parse later
                    .setLabel(label)
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        try {
            // Send the message with buttons to the target channel
            const message = await channel.send({
                content: messageContent,
                components: [actionRow],
            });

            // Save the entire configuration to MongoDB
            await GuildConfig.findOneAndUpdate(
                { guildId: interaction.guildId },
                {
                    guildId: interaction.guildId,
                    buttonCategories: buttonCategories,
                    messageId: message.id,
                    channelId: channel.id,
                },
                { upsert: true, new: true }
            );

            await interaction.editReply(`✅ Successfully set up the role message in ${channel}!`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ I do not have permission to send messages in that channel.');
        }
    },
};
