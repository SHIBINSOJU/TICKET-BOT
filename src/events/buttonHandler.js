const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const TicketConfig = require('../models/ticketConfig');

module.exports = async (interaction) => {
    if (!interaction.isButton()) return;

    // --- TICKET CREATION LOGIC ---
    if (interaction.customId.startsWith('create-ticket:')) {
        await interaction.deferReply({ ephemeral: true });

        const config = await TicketConfig.findOne({ guildId: interaction.guildId });
        if (!config) {
            return interaction.editReply({ content: 'This ticket system has not been configured properly.' });
        }

        const buttonData = config.buttons.find(b => b.customId === interaction.customId);
        if (!buttonData) {
            return interaction.editReply({ content: 'This button is part of an outdated configuration.' });
        }

        const channelName = `ticket-${interaction.user.username}`;
        
        // Prevent duplicate tickets
        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) {
            return interaction.editReply(`You already have an open ticket: ${existingChannel}`);
        }

        try {
            // Create the ticket channel
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: config.ticketCategoryId, // Place it in the configured category
                permissionOverwrites: [
                    {
                        id: interaction.guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id, // The user who opened the ticket
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
                    },
                    {
                        id: config.staffRoleId, // Staff role
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
                    },
                ],
            });

            const embed = new EmbedBuilder()
                .setTitle(`Ticket: ${buttonData.label}`)
                .setDescription(`Welcome, ${interaction.user}! Please describe your issue, and a staff member will be with you shortly.`)
                .setColor('#0099ff');
            
            const closeButton = new ButtonBuilder()
                .setCustomId('close-ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(closeButton);

            await ticketChannel.send({
                content: `${interaction.user} <@&${config.staffRoleId}>`, // Ping user and staff
                embeds: [embed],
                components: [row],
            });

            await interaction.editReply(`✅ Your ticket has been created: ${ticketChannel}`);

        } catch (error) {
            console.error('Error creating ticket channel:', error);
            await interaction.editReply({ content: 'There was an error creating your ticket. Please contact an administrator.' });
        }

        return;
    }

    // --- TICKET CLOSING LOGIC ---
    if (interaction.customId === 'close-ticket') {
        await interaction.reply({ content: '🔒 Closing this ticket in 5 seconds...' });
        setTimeout(() => {
            interaction.channel.delete().catch(err => console.error("Couldn't delete channel:", err));
        }, 5000);
    }
};
