const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const commands = [
    // 1. الهوية الرقمية وبطاقة النخبة
    new SlashCommandBuilder()
        .setName('pass')
        .setDescription('عرض بطاقة العضوية والنخبة الرقمية الخاصة بك')
        .addUserOption(opt => opt.setName('target').setDescription('المستثمر (اختياري)')),

    // 2. المحفظة الاستثمارية للأسهم
    new SlashCommandBuilder()
        .setName('portfolio')
        .setDescription('عرض محفظتك الاستثمارية والأسهم التي تملكها بالتفصيل')
        .addUserOption(opt => opt.setName('target').setDescription('المستثمر (اختياري)')),

    // 3. البنك المركزي والخزينة
    new SlashCommandBuilder()
        .setName('bank')
        .setDescription('كشف الحساب المصرفي والخزنة الاستثمارية'),

    new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('إيداع أموال في الخزنة الاستثمارية لكسب عوائد دورية')
        .addIntegerOption(opt => opt.setName('amount').setDescription('المبلغ').setRequired(true)),

    new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('تحويل بنكي مشفر لعضو آخر مع إيصال مالي')
        .addUserOption(opt => opt.setName('target').setDescription('المستلم').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('المبلغ').setRequired(true)),

    // 4. البورصة والتداول
    new SlashCommandBuilder()
        .setName('stocks')
        .setDescription('شاشة أسعار الأسهم وحركة البورصة الحية'),

    new SlashCommandBuilder()
        .setName('buy')
        .setDescription('شراء أسهم من البورصة')
        .addStringOption(opt => opt.setName('symbol').setDescription('رمز السهم').setRequired(true))
        .addIntegerOption(opt => opt.setName('shares').setDescription('عدد الأسهم').setRequired(true)),

    new SlashCommandBuilder()
        .setName('sell')
        .setDescription('بيع أسهم من محفظتك')
        .addStringOption(opt => opt.setName('symbol').setDescription('رمز السهم').setRequired(true))
        .addIntegerOption(opt => opt.setName('shares').setDescription('عدد الأسهم').setRequired(true)),

    // 5. المزادات والعقود
    new SlashCommandBuilder()
        .setName('auction-start')
        .setDescription('بدء مزاد علني جديد في السيرفر')
        .addStringOption(opt => opt.setName('item').setDescription('السلعة أو الرتبة').setRequired(true))
        .addIntegerOption(opt => opt.setName('starting_bid').setDescription('السعر الافتتاحي').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('bounties')
        .setDescription('لوحة العقود والمهام الاستثمارية اليومية'),

    // 6. الحوكمة والتصويت
    new SlashCommandBuilder()
        .setName('proposal')
        .setDescription('طرح مقترح استثماري أو إداري للتصويت العام')
        .addStringOption(opt => opt.setName('title').setDescription('عنوان المقترح').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('تفاصيل المقترح').setRequired(true)),

    // 7. لوحة العمليات المركزية
    new SlashCommandBuilder()
        .setName('mainframe')
        .setDescription('شاشة المراقبة المركزية والاحتياطي الفيدرالي للسيرفر')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('⚡ [SYSTEM] جاري تسجيل وتحديث منظومة الأوامر...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('🟢 [READY] تم تسجيل كافة أوامر السلاش بنجاح!');
    } catch (err) {
        console.error('❌ خطأ أثناء تسجيل الأوامر:', err);
    }
})();