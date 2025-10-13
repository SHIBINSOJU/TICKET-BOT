const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const TicketConfig = require('../models/ticketConfig');
const crypto = require('crypto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-add-button')
        .setDescription('Adds a new ticket category button to the panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('label')
                .setDescription('The text that appears on the button (e.g., "General Support").')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('The emoji to display on the button.')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const label = interaction.options.getString('label');
        const emoji = interaction.options.getString('emoji');

        const config = await TicketConfig.findOne({ guildId: interaction.guildId });

        if (!config) {
            return interaction.editReply('❌ You must run `/ticket-setup` before you can add buttons.');
        }

        if (config.buttons.length >= 5) {
            return interaction.editReply('❌ You have reached the maximum of 5 buttons for this panel.');
        }

        const newButton = {
            customId: `create-ticket:${crypto.randomUUID()}`,
            label: label,
            emoji: emoji || null,
        };

        config.buttons.push(newButton);
        await config.save();

        // --- Update the original message with the new button ---
        try {
            const channel = await interaction.guild.channels.fetch(config.channelId);
            const message = await channel.messages.fetch(config.messageId);

            const row = new ActionRowBuilder();
            config.buttons.forEach(button => {
                const newBtn = new ButtonBuilder()
                    .setCustomId(button.customId)
                    .setLabel(button.label)
                    .setStyle(ButtonStyle.Secondary);
                if (button.emoji) {
                    newBtn.setEmoji(button.emoji);
                }
                row.addComponents(newBtn);
            });

            await message.edit({ components: [row] });
            await interaction.editReply(`✅ Button "${label}" has been added to the ticket panel.`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Could not find the original ticket panel message to update.');
        }
    },
};
