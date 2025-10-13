const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../../models/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets up the ticket panel and system for this server.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the ticket panel will be sent.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('log_channel')
                .setDescription('The channel where ticket logs will be sent.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('ticket_category')
                .setDescription('The category where new ticket channels will be created.')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('support_role')
                .setDescription('The role that will have access to all tickets.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only admins can use this

    async execute(interaction) {
        // Defer reply to give us more time to process
        await interaction.deferReply({ ephemeral: true });

        const panelChannel = interaction.options.getChannel('channel');
        const logChannel = interaction.options.getChannel('log_channel');
        const ticketCategory = interaction.options.getChannel('ticket_category');
        const supportRole = interaction.options.getRole('support_role');

        try {
            // Panel Embed
            const panelEmbed = new EmbedBuilder()
                .setTitle('Create a Ticket')
                .setDescription('Select a category below to open a ticket. Please provide as much detail as possible when prompted.')
                .setColor('#0099ff')
                .setFooter({ text: `${interaction.guild.name} | Ticket System` });

            // Buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_create_support')
                        .setLabel('Support')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🧾'),
                    new ButtonBuilder()
                        .setCustomId('ticket_create_bug')
                        .setLabel('Bug Report')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🐞'),
                    new ButtonBuilder()
                        .setCustomId('ticket_create_application')
                        .setLabel('Staff Application')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🧑‍💼')
                );

            // Send the panel message
            const panelMessage = await panelChannel.send({ embeds: [panelEmbed], components: [buttons] });

            // Save the configuration to MongoDB
            // findOneAndUpdate will find a document with the guildId and update it, or create a new one if it doesn't exist (upsert: true)
            await GuildConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    panelChannelId: panelChannel.id,
                    panelMessageId: panelMessage.id,
                    logChannelId: logChannel.id,
                    supportRoleIds: [supportRole.id], // Stored as an array
                    ticketCategoryId: ticketCategory.id,
                },
                { upsert: true, new: true }
            );

            await interaction.editReply({ content: `Ticket panel has been successfully set up in ${panelChannel}.`, ephemeral: true });

        } catch (error) {
            console.error('Error setting up the ticket panel:', error);
            await interaction.editReply({ content: 'An error occurred while setting up the ticket panel. Please check my permissions and try again.', ephemeral: true });
        }
    },
};
