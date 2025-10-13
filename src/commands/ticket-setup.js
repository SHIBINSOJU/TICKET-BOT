const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const TicketConfig = require('../models/ticketConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Creates the initial ticket panel message.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the ticket panel to.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title of the ticket embed.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('The message to display in the ticket embed.')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');

        try {
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor('#0099ff')
                .setFooter({ text: 'Click a button below to open a ticket.' });

            const panelMessage = await channel.send({ embeds: [embed] });

            // Save the new configuration to the database
            await TicketConfig.findOneAndUpdate(
                { guildId: interaction.guildId },
                {
                    guildId: interaction.guildId,
                    channelId: channel.id,
                    messageId: panelMessage.id,
                    title: title,
                    description: description,
                    buttons: [], // Start with an empty array of buttons
                },
                { upsert: true, new: true }
            );

            await interaction.editReply(`✅ Ticket panel successfully created in ${channel}.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ I do not have permission to send messages in that channel.');
        }
    },
};
