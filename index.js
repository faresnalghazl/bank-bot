require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Events, 
    MessageFlags 
} = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'mainframe.db'));

// تهيئة جداول قاعدة البيانات مع حقول تتبع المهام
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        citizenId INTEGER,
        cash REAL DEFAULT 10000.0,
        vault REAL DEFAULT 0.0,
        portfolio TEXT DEFAULT '{}',
        trustScore INTEGER DEFAULT 100,
        createdTimestamp INTEGER,
        lastBountyClaim INTEGER DEFAULT 0,
        dailyMessages INTEGER DEFAULT 0,
        dailyTrades INTEGER DEFAULT 0,
        lastTaskReset INTEGER DEFAULT 0
    )
`).run();

// التحقق من إضافة الأعمدة إذا كانت القاعدة منشأة مسبقاً
const columns = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
if (!columns.includes('lastBountyClaim')) db.prepare(`ALTER TABLE users ADD COLUMN lastBountyClaim INTEGER DEFAULT 0`).run();
if (!columns.includes('dailyMessages')) db.prepare(`ALTER TABLE users ADD COLUMN dailyMessages INTEGER DEFAULT 0`).run();
if (!columns.includes('dailyTrades')) db.prepare(`ALTER TABLE users ADD COLUMN dailyTrades INTEGER DEFAULT 0`).run();
if (!columns.includes('lastTaskReset')) db.prepare(`ALTER TABLE users ADD COLUMN lastTaskReset INTEGER DEFAULT 0`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS treasury (
        id INTEGER PRIMARY KEY,
        reserve REAL DEFAULT 5000000.0
    )
`).run();

const initTreasury = db.prepare('SELECT * FROM treasury WHERE id = 1').get();
if (!initTreasury) {
    db.prepare('INSERT INTO treasury (id, reserve) VALUES (1, 5000000.0)').run();
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// روابط الصور والبانرات الفخمة
const ASSETS = {
    BLACK_CARD: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop',
    BANK_VAULT: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?q=80&w=1000&auto=format&fit=crop',
    STOCK_CHART: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1000&auto=format&fit=crop',
    AUCTION_BANNER: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1000&auto=format&fit=crop',
    MAINFRAME: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1000&auto=format&fit=crop',
    GOLD_BADGE: 'https://cdn-icons-png.flaticon.com/512/2583/2583907.png'
};

function createBar(current, total = 100, size = 10) {
    const ratio = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.round(size * ratio);
    const empty = size - filled;
    return `\`[${'■'.repeat(filled)}${'□'.repeat(empty)}]\` ${(ratio * 100).toFixed(0)}%`;
}

// مصفوفة الأسهم مع تثبيت السعر المرجعي الأساسي (basePrice)
const stockMarket = {
    'ARAMCO': { name: 'Saudi Aramco', price: 31.20, basePrice: 31.20, change: 0.0, prev: 31.20, volatility: 0.03, icon: '🛢️' },
    'NVDA':   { name: 'Nvidia Corp', price: 128.50, basePrice: 128.50, change: 0.0, prev: 128.50, volatility: 0.06, icon: '⚡' },
    'AAPL':   { name: 'Apple Inc', price: 218.00, basePrice: 218.00, change: 0.0, prev: 218.00, volatility: 0.04, icon: '🍏' },
    'TSLA':   { name: 'Tesla Inc', price: 245.00, basePrice: 245.00, change: 0.0, prev: 245.00, volatility: 0.08, icon: '🚗' },
    'BTC':    { name: 'Bitcoin Asset', price: 64200.00, basePrice: 64200.00, change: 0.0, prev: 64200.00, volatility: 0.10, icon: '🪙' }
};

const activeAuctions = new Map();
const activeProposals = new Map();

function getUser(userId) {
    let user = db.prepare('SELECT * FROM users WHERE userId = ?').get(userId);
    if (!user) {
        const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c + 1;
        db.prepare(`
            INSERT INTO users (userId, citizenId, cash, vault, portfolio, trustScore, createdTimestamp, lastBountyClaim, dailyMessages, dailyTrades, lastTaskReset)
            VALUES (?, ?, 10000.0, 0.0, '{}', 100, ?, 0, 0, 0, ?)
        `).run(userId, count, Date.now(), Date.now());
        user = db.prepare('SELECT * FROM users WHERE userId = ?').get(userId);
    }
    user.portfolio = JSON.parse(user.portfolio);

    // تصفير المهام اليومية كل 24 ساعة
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - user.lastTaskReset > oneDay) {
        user.dailyMessages = 0;
        user.dailyTrades = 0;
        user.lastTaskReset = Date.now();
        saveUser(user);
    }

    return user;
}

function saveUser(user) {
    db.prepare(`
        UPDATE users 
        SET cash = ?, vault = ?, portfolio = ?, trustScore = ?, lastBountyClaim = ?, dailyMessages = ?, dailyTrades = ?, lastTaskReset = ?
        WHERE userId = ?
    `).run(
        user.cash, 
        user.vault, 
        JSON.stringify(user.portfolio), 
        user.trustScore, 
        user.lastBountyClaim, 
        user.dailyMessages, 
        user.dailyTrades, 
        user.lastTaskReset, 
        user.userId
    );
}

function getTier(netWorth) {
    if (netWorth >= 1000000) return { name: 'OBSIDIAN ELITE', color: 0x0A0A0A, icon: '💎', badge: '★★★★' };
    if (netWorth >= 250000) return { name: 'PLATINUM PARTNER', color: 0xE5E4E2, icon: '🏛️', badge: '★★★☆' };
    if (netWorth >= 50000) return { name: 'GOLD CITIZEN', color: 0xF1C40F, icon: '🪙', badge: '★★☆☆' };
    return { name: 'SILVER MEMBER', color: 0x95A5A6, icon: '💳', badge: '★☆☆☆' };
}

function getNetWorth(user) {
    let stockVal = 0;
    for (const [sym, shares] of Object.entries(user.portfolio)) {
        if (stockMarket[sym]) stockVal += shares * stockMarket[sym].price;
    }
    return user.cash + user.vault + stockVal;
}

// تتبع رسائل الأعضاء لاحتساب مهمة الشات اليومية
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const u = getUser(message.author.id);
    if (u.dailyMessages < 5) {
        u.dailyMessages += 1;
        saveUser(u);
    }
});

// محرك البورصة: كل 3 دقائق مع قفزات (50% إلى 90%) ومنطق الارتداد والتعافي
setInterval(() => {
    for (const sym in stockMarket) {
        const s = stockMarket[sym];
        s.prev = s.price;

        const isCrazyEvent = Math.random() < 0.15; // فرصة 15% لحدث استثنائي

        let delta;
        if (isCrazyEvent) {
            const crazyPercent = (Math.floor(Math.random() * 41) + 50) / 100; // بين 50% إلى 90%
            
            // إذا انهار السهم تحت 60% من سعره الأساسي -> ارتداد صعودي إجباري
            if (s.price < s.basePrice * 0.6) {
                delta = crazyPercent; 
            } else if (s.price > s.basePrice * 2.2) {
                // إذا تضخم السهم جداً فوق ضعفي قيمته -> تصحيح هبوطي
                delta = -crazyPercent;
            } else {
                delta = (Math.random() > 0.35 ? 1 : -1) * crazyPercent;
            }
        } else {
            // التذبذب الطبيعي + قوة سحب خفيفة تجاه السعر العادل (Mean Reversion)
            const naturalDir = Math.random() > 0.48 ? 1 : -1;
            const naturalDelta = (Math.random() * s.volatility) * naturalDir;
            const pullBack = (s.basePrice - s.price) / s.basePrice * 0.04;
            delta = naturalDelta + pullBack;
        }

        let np = s.price * (1 + delta);
        if (np < 1.0) np = 1.0;

        s.price = parseFloat(np.toFixed(2));
        s.change = parseFloat(((s.price - s.prev) / s.prev * 100).toFixed(2));
    }
}, 3 * 60 * 1000);

client.once(Events.ClientReady, c => {
    console.log(`✨ [MAINFRAME VISUAL SUITE READY]: ${c.user.tag}`);
});

// ----------------------------------------------------
// معالجة الأوامر والتفاعلات بالأزرار
// ----------------------------------------------------
client.on(Events.InteractionCreate, async interaction => {
    
    // 1. تفاعلات الأزرار فقط (Buttons)
    if (interaction.isButton()) {
        const { customId, user } = interaction;

        // مزاد
        if (customId.startsWith('bid_')) {
            const auctionId = customId.split('_')[1];
            const auction = activeAuctions.get(auctionId);
            if (!auction) return interaction.reply({ content: '❌ انتهى المزاد!', flags: MessageFlags.Ephemeral });

            const u = getUser(user.id);
            const nextBid = auction.currentBid + auction.increment;

            if (u.cash < nextBid) {
                return interaction.reply({ content: `❌ سيولتك ($${u.cash.toLocaleString('en-US')}) لا تغطي المبلغ المطلوب ($${nextBid.toLocaleString('en-US')}).`, flags: MessageFlags.Ephemeral });
            }

            if (auction.highestBidder) {
                const prev = getUser(auction.highestBidder);
                prev.cash += auction.currentBid;
                saveUser(prev);
            }

            u.cash -= nextBid;
            saveUser(u);

            auction.currentBid = nextBid;
            auction.highestBidder = user.id;

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    { name: '📦 السلعة المعروضة', value: `\`${auction.item}\``, inline: true },
                    { name: '💰 أعلى مزايدة', value: `\`$${auction.currentBid.toLocaleString('en-US')}\``, inline: true },
                    { name: '👑 المزايد الحالي', value: `${user}`, inline: false }
                );

            return interaction.update({ embeds: [updatedEmbed] });
        }

        // تصويت
        if (customId.startsWith('vote_')) {
            const [_, pId, choice] = customId.split('_');
            const prop = activeProposals.get(pId);
            if (!prop) return interaction.reply({ content: '❌ انتهت فترة هذا التصويت أو تم إغلاقه.', flags: MessageFlags.Ephemeral });

            if (choice === 'end') {
                const totalVotes = prop.yes + prop.no;
                let resultText = '🤝 **النتيجة: تعادل في الأصوات.**';
                let resultColor = 0x95A5A6;

                if (prop.yes > prop.no) {
                    resultText = '🎉 **النتيجة: تمت الموافقة والاعتماد بالأغلبية!**';
                    resultColor = 0x2ECC71;
                } else if (prop.yes < prop.no) {
                    resultText = '❌ **النتيجة: تم رفض القرار بالأغلبية.**';
                    resultColor = 0xED4245;
                }

                const finalEmbed = new EmbedBuilder()
                    .setColor(resultColor)
                    .setTitle(`📊 النتائج النهائية للتصويت: ${prop.title}`)
                    .setDescription(
                        `${prop.desc}\n\n` +
                        `\`\`\`asciidoc\n` +
                        `[ إجمالي المؤيدين ] :: ${prop.yes} صوت\n` +
                        `[ إجمالي المعترضين] :: ${prop.no} صوت\n` +
                        `[ مجموع ثقل الأصوات] :: ${totalVotes} صوت\n` +
                        `========================================\`\`\`\n` +
                        `${resultText}`
                    )
                    .setFooter({ text: 'تم إغلاق التصويت وتوثيق النتيجة رسمياً' })
                    .setTimestamp();

                activeProposals.delete(pId);
                return interaction.update({ embeds: [finalEmbed], components: [] });
            }

            if (prop.voters.has(user.id)) {
                return interaction.reply({ content: '⚠️ لقد قمت بالتصويت مسبقاً على هذا القرار!', flags: MessageFlags.Ephemeral });
            }

            const u = getUser(user.id);
            const net = getNetWorth(u);
            const weight = net >= 1000000 ? 5 : net >= 250000 ? 3 : net >= 50000 ? 2 : 1;

            prop.voters.add(user.id);
            if (choice === 'yes') prop.yes += weight;
            if (choice === 'no') prop.no += weight;

            const liveEmbed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`🗳️ تصويت رسمي: ${prop.title}`)
                .setDescription(
                    `${prop.desc}\n\n` +
                    `\`\`\`asciidoc\n` +
                    `[ الأصوات المؤيدة ] :: ${prop.yes} صوت\n` +
                    `[ الأصوات المعترضة] :: ${prop.no} صوت\n` +
                    `========================================\`\`\``
                )
                .setFooter({ text: 'يتم احتساب ثقل الصوت وفقاً لرتبة بطاقتك وصافي ثروتك' })
                .setTimestamp();

            await interaction.update({ embeds: [liveEmbed] });
            return interaction.followUp({ content: `✅ سُجّل صوتك بثقل **[+${weight} أصوات]**!`, flags: MessageFlags.Ephemeral });
        }

        // استلام مكافأة العقد
        if (customId === 'claim_bounty_daily') {
            const u = getUser(user.id);
            const oneDay = 24 * 60 * 60 * 1000;

            if (Date.now() - u.lastBountyClaim < oneDay) {
                const nextClaimTime = Math.floor((u.lastBountyClaim + oneDay) / 1000);
                return interaction.reply({ 
                    content: `⏳ **لقد استلمت مستحقات العقد مسبقاً!** يمكنك الاستلام مجدداً <t:${nextClaimTime}:R>.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const task1Done = u.dailyMessages >= 5;
            const task2Done = u.dailyTrades >= 1;
            const task3Done = u.vault > 0;

            if (!task1Done || !task2Done || !task3Done) {
                let missing = [];
                if (!task1Done) missing.push(`• إرسال رسائل في الشات (\`${u.dailyMessages}/5\`)`);
                if (!task2Done) missing.push(`• إجراء صفقة تداول في البورصة (\`${u.dailyTrades}/1\`)`);
                if (!task3Done) missing.push(`• إيداع مبلغ في الخزنة الاستثمارية عبر \`/deposit\``);

                return interaction.reply({ 
                    content: `❌ **لم تكتمل جميع المهام المطلوبة بعد!**\nالمهام المتبقية لديك:\n${missing.join('\n')}`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const reward = 3500.0;
            u.cash += reward;
            u.trustScore = Math.min(u.trustScore + 5, 100);
            u.lastBountyClaim = Date.now();
            saveUser(u);

            const successEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🎯 تم اعتماد إكمال العقد بنجاح')
                .setDescription(
                    `تهانينا! لقد أتممت جميع المهام التشغيلية لهذا اليوم.\n\n` +
                    `💵 **المكافأة:** \`+$${reward.toLocaleString('en-US')}\` مودعة في حسابك النقدي.\n` +
                    `⭐ **مؤشر الثقة:** \`+5 نقاط\` (الحالي: \`${u.trustScore}/100\`).`
                )
                .setFooter({ text: 'تتجدد المهام والعقود غداً' })
                .setTimestamp();

            return interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
        }

        return;
    }

    // 2. التحقق من أوامر السلاش (Slash Commands)
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, guild } = interaction;

    // عرض المحفظة الاستثمارية (/portfolio)
    if (commandName === 'portfolio') {
        await interaction.deferReply();
        const target = options.getUser('target') || user;
        const u = getUser(target.id);

        let portfolioList = [];
        let totalStocksValue = 0;

        for (const [sym, shares] of Object.entries(u.portfolio)) {
            if (shares > 0 && stockMarket[sym]) {
                const item = stockMarket[sym];
                const currentVal = shares * item.price;
                totalStocksValue += currentVal;

                portfolioList.push(
                    `${item.icon} **${sym}** \`[${item.name}]\`\n` +
                    `├ الكمية: \`${shares.toLocaleString('en-US')}\` سهم\n` +
                    `├ السعر الحالي: \`$${Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}\`\n` +
                    `└ القيمة الإجمالية: **$${Number(currentVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`
                );
            }
        }

        const detailsText = portfolioList.length > 0 
            ? portfolioList.join('\n\n') 
            : '*لا توجد أي أسهم مملوكة في محفظتك حالياً. استخدم `/stocks` و `/buy` للشراء.*';

        const totalNetWorth = u.cash + u.vault + totalStocksValue;
        const tier = getTier(totalNetWorth);

        const portEmbed = new EmbedBuilder()
            .setColor(0x00F0FF)
            .setAuthor({ name: `INVESTMENT PORTFOLIO • ${tier.name}`, iconURL: ASSETS.GOLD_BADGE })
            .setTitle(`💼 المحفظة الاستثمارية لـ ${target.username}`)
            .setDescription(
                `\`\`\`asciidoc\n` +
                `[ إجمالي قيمة الأسهم ] :: $${Number(totalStocksValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
                `[ السيولة النقدية     ] :: $${Number(u.cash).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
                `========================================\`\`\`\n\n` +
                `### 📦 الأصول والأسهم المملوكة:\n${detailsText}`
            )
            .setImage(ASSETS.STOCK_CHART)
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: 'تتغير قيمة المحفظة مباشرة مع تغير أسعار البورصة' })
            .setTimestamp();

        return interaction.editReply({ embeds: [portEmbed] });
    }

    // بطاقة النخبة (/pass)
    if (commandName === 'pass') {
        await interaction.deferReply();
        const target = options.getUser('target') || user;
        const u = getUser(target.id);
        const netWorth = getNetWorth(u);
        const tier = getTier(netWorth);

        const passEmbed = new EmbedBuilder()
            .setColor(tier.color)
            .setAuthor({ name: `CITIZEN IDENTIFICATION • ${tier.name}`, iconURL: ASSETS.GOLD_BADGE })
            .setTitle(`${tier.icon} بطاقة النخبة السوداء | #${String(u.citizenId).padStart(4, '0')}`)
            .setDescription(
                `\`\`\`asciidoc\n` +
                `[ الرتبة ]     :: ${tier.name} ${tier.badge}\n` +
                `[ مؤشر الثقة ] :: ${createBar(u.trustScore, 100, 8)}\n` +
                `========================================\`\`\``
            )
            .addFields(
                { name: '💵 السيولة النقدية', value: `\`$${Number(u.cash).toLocaleString('en-US', { minimumFractionDigits: 2 })}\``, inline: true },
                { name: '🔒 الخزنة الاستثمارية', value: `\`$${Number(u.vault).toLocaleString('en-US', { minimumFractionDigits: 2 })}\``, inline: true },
                { name: '💎 صافي الثروة الكلية', value: `\`$${Number(netWorth).toLocaleString('en-US', { minimumFractionDigits: 2 })}\``, inline: false }
            )
            .setImage(ASSETS.BLACK_CARD)
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `${guild.name} • Official Member Pass` })
            .setTimestamp();

        return interaction.editReply({ embeds: [passEmbed] });
    }

    // البنك المركزي (/bank)
    if (commandName === 'bank') {
        await interaction.deferReply();
        const u = getUser(user.id);
        const total = u.cash + u.vault;

        const bankEmbed = new EmbedBuilder()
            .setColor(0xD4AF37)
            .setAuthor({ name: 'FEDERAL RESERVE BANK', iconURL: ASSETS.GOLD_BADGE })
            .setTitle('🏛️ كشف الحساب والودائع المصرفية')
            .setDescription(
                `\`\`\`asciidoc\n` +
                `نسبة الودائع المجمدة :: ${createBar(u.vault, total || 1, 10)}\n` +
                `========================================\`\`\``
            )
            .addFields(
                { name: '💵 الحساب الجاري (Liquid)', value: `\`$${Number(u.cash).toLocaleString('en-US', { minimumFractionDigits: 2 })}\``, inline: true },
                { name: '🔒 الخزانة الاستثمارية (Vault)', value: `\`$${Number(u.vault).toLocaleString('en-US', { minimumFractionDigits: 2 })}\``, inline: true }
            )
            .setImage(ASSETS.BANK_VAULT)
            .setFooter({ text: 'استخدم /deposit لإيداع أموال في الخزنة' })
            .setTimestamp();

        return interaction.editReply({ embeds: [bankEmbed] });
    }

    // الإيداع بالخزنة (/deposit)
    if (commandName === 'deposit') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const amount = options.getInteger('amount');
        const u = getUser(user.id);

        if (amount <= 0 || u.cash < amount) return interaction.editReply({ content: '❌ رصيدك لا يكفي.' });

        u.cash -= amount;
        u.vault += amount;
        saveUser(u);

        return interaction.editReply({ content: `🔒 تم تحويل **$${Number(amount).toLocaleString('en-US')}** إلى الخزانة الاستثمارية بنجاح.` });
    }

    // التحويل المالي (/transfer)
    if (commandName === 'transfer') {
        await interaction.deferReply();
        const target = options.getUser('target');
        const amount = options.getInteger('amount');
        const u = getUser(user.id);

        if (target.id === user.id || target.bot || amount <= 0 || u.cash < amount) {
            return interaction.editReply({ content: '❌ تعذر إتمام التحويل، تأكد من صحة الحساب والرصيد.' });
        }

        const receiver = getUser(target.id);
        u.cash -= amount;
        receiver.cash += amount;
        saveUser(u);
        saveUser(receiver);

        const txHash = Buffer.from(`${user.id}-${Date.now()}`).toString('base64').substring(0, 12);

        const receiptEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🧾 إيصال تحويل مصرفي معتمد')
            .setDescription(`\`\`\`yaml\nRef: "TX-${txHash}"\nStatus: "SETTLED // VERIFIED"\`\`\``)
            .addFields(
                { name: '👤 المحوّل', value: `${user}`, inline: true },
                { name: '📥 المستلم', value: `${target}`, inline: true },
                { name: '💰 المبلغ المحول', value: `\`$${Number(amount).toLocaleString('en-US')}\``, inline: false }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [receiptEmbed] });
    }

    // شاشة الأسهم بتنسيق أرقام دقيق (/stocks)
    if (commandName === 'stocks') {
        await interaction.deferReply();
        
        const list = Object.entries(stockMarket).map(([sym, item]) => {
            const ind = item.change >= 0 ? '🟢 +' : '🔴 ';
            const formattedPrice = Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedChange = Number(item.change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            
            return `${item.icon} **${sym}** \`[${item.name}]\`\n└ **$${formattedPrice}** (${ind}${formattedChange}%)`;
        }).join('\n\n');

        const stockEmbed = new EmbedBuilder()
            .setColor(0x00F0FF)
            .setAuthor({ name: 'GLOBAL EXCHANGE TICKER', iconURL: ASSETS.GOLD_BADGE })
            .setTitle('📈 شاشة حركة الأسهم والبورصة الحية')
            .setDescription(list)
            .setImage(ASSETS.STOCK_CHART)
            .setFooter({ text: 'الأوامر: /buy للشراء | /sell للبيع' })
            .setTimestamp();

        return interaction.editReply({ embeds: [stockEmbed] });
    }

    // شراء أسهم (/buy)
    if (commandName === 'buy') {
        await interaction.deferReply();
        const sym = options.getString('symbol').toUpperCase();
        const shares = options.getInteger('shares');
        const u = getUser(user.id);

        if (!stockMarket[sym] || shares <= 0) return interaction.editReply({ content: '❌ بيانات السهم غير صحيحة.' });

        const cost = shares * stockMarket[sym].price;
        if (u.cash < cost) return interaction.editReply({ content: `❌ السيولة غير كافية! المطلوب: **$${Number(cost).toLocaleString('en-US')}**` });

        u.cash -= cost;
        u.portfolio[sym] = (u.portfolio[sym] || 0) + shares;
        u.dailyTrades += 1;
        saveUser(u);

        const buyEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle(`📈 تم شراء ${shares} سهم من ${sym}`)
            .setDescription(`القيمة الإجمالية: **$${Number(cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}**\nالسيولة المتبقية: **$${Number(u.cash).toLocaleString('en-US', { minimumFractionDigits: 2 })}**`)
            .setTimestamp();

        return interaction.editReply({ embeds: [buyEmbed] });
    }

    // بيع أسهم (/sell)
    if (commandName === 'sell') {
        await interaction.deferReply();
        const sym = options.getString('symbol').toUpperCase();
        const shares = options.getInteger('shares');
        const u = getUser(user.id);

        if (!stockMarket[sym] || shares <= 0) return interaction.editReply({ content: '❌ سهم غير صحيح.' });

        const owned = u.portfolio[sym] || 0;
        if (owned < shares) return interaction.editReply({ content: `❌ تملك فقط: **${owned}** سهم.` });

        const totalReturn = shares * stockMarket[sym].price;
        u.portfolio[sym] -= shares;
        if (u.portfolio[sym] === 0) delete u.portfolio[sym];
        u.cash += totalReturn;
        u.dailyTrades += 1;
        saveUser(u);

        const sellEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`📉 تم بيع ${shares} سهم من ${sym}`)
            .setDescription(`تم إيداع: **+$${Number(totalReturn).toLocaleString('en-US', { minimumFractionDigits: 2 })}** في حسابك.`)
            .setTimestamp();

        return interaction.editReply({ embeds: [sellEmbed] });
    }

    // المزادات (/auction-start)
    if (commandName === 'auction-start') {
        const item = options.getString('item');
        const startBid = options.getInteger('starting_bid');

        const auctionId = String(Date.now());
        activeAuctions.set(auctionId, {
            item,
            currentBid: startBid,
            highestBidder: null,
            increment: Math.max(Math.floor(startBid * 0.1), 500)
        });

        const auctionEmbed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setAuthor({ name: 'ROYAL AUCTION HOUSE', iconURL: ASSETS.GOLD_BADGE })
            .setTitle(`🏷️ مزاد علني حصري: ${item}`)
            .setDescription('اضغط على الزر أدناه لتقديم مزايدتك فورياً.')
            .addFields(
                { name: '📦 السلعة المعروضة', value: `\`${item}\``, inline: true },
                { name: '💰 السعر الافتتاحي', value: `\`$${Number(startBid).toLocaleString('en-US')}\``, inline: true },
                { name: '👑 صاحب أعلى مزايدة', value: '*لا يوجد حتى الآن*', inline: false }
            )
            .setImage(ASSETS.AUCTION_BANNER)
            .setFooter({ text: 'المزايدة تخصم السيولة فوراً' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`bid_${auctionId}`)
                .setLabel('مزايدة ورفع السعر ⚡')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [auctionEmbed], components: [row] });
    }

    // العقود والمهام (/bounties)
    if (commandName === 'bounties') {
        const u = getUser(user.id);
        const task1Icon = u.dailyMessages >= 5 ? '✅' : '❌';
        const task2Icon = u.dailyTrades >= 1 ? '✅' : '❌';
        const task3Icon = u.vault > 0 ? '✅' : '❌';

        const oneDay = 24 * 60 * 60 * 1000;
        const isClaimed = (Date.now() - u.lastBountyClaim) < oneDay;
        const statusText = isClaimed 
            ? `🟢 **تم تحصيل العقد اليوم** (يتجدد <t:${Math.floor((u.lastBountyClaim + oneDay)/1000)}:R>)` 
            : (task1Icon === '✅' && task2Icon === '✅' && task3Icon === '✅') 
            ? '🔥 **اكتملت جميع المهام! اضغط على الزر لاستلام المكافأة.**' 
            : '⏳ **قيد الإنجاز... أكمل المهام الناقصة أدناه.**';

        const bountyEmbed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('📜 لوحة العقود والمهام التشغيلية اليومية')
            .setDescription(
                `${statusText}\n\n` +
                `\`\`\`asciidoc\n` +
                `[${task1Icon}] 1. إرسال 5 رسائل بالشات  :: (${u.dailyMessages}/5 رسائل)\n` +
                `[${task2Icon}] 2. إتمام صفقة بالبورصة   :: (${u.dailyTrades}/1 صفقة)\n` +
                `[${task3Icon}] 3. إيداع أموال في الخزنة :: (${u.vault > 0 ? 'مكتمل' : 'غير مكتمل'})\n` +
                `========================================\`\`\``
            )
            .addFields(
                { name: '💵 المكافأة', value: '`$3,500.00`', inline: true },
                { name: '⭐ نقاط الثقة', value: '`+5 Points`', inline: true }
            )
            .setFooter({ text: 'تتجدد المهام يومياً وتتطلب إنجازاً فعلياً' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_bounty_daily')
                .setLabel('تحصيل مستحقات العقد 💼')
                .setStyle(isClaimed ? ButtonStyle.Secondary : ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [bountyEmbed], components: [row] });
    }

    // الحوكمة والتصويت (/proposal)
    if (commandName === 'proposal') {
        const title = options.getString('title');
        const desc = options.getString('description');

        const pId = String(Date.now());
        activeProposals.set(pId, { 
            title, 
            desc, 
            yes: 0, 
            no: 0, 
            voters: new Set(), 
            creator: user.id 
        });

        const propEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`🗳️ تصويت رسمي: ${title}`)
            .setDescription(
                `${desc}\n\n` +
                `\`\`\`asciidoc\n` +
                `[ الأصوات المؤيدة ] :: 0 صوت\n` +
                `[ الأصوات المعترضة] :: 0 صوت\n` +
                `========================================\`\`\``
            )
            .setFooter({ text: 'يتم احتساب ثقل الصوت وفقاً لرتبة بطاقتك وصافي ثروتك' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vote_${pId}_yes`).setLabel('موافق (Support) ✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`vote_${pId}_no`).setLabel('معترض (Oppose) ❌').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`vote_${pId}_end`).setLabel('إنهاء وإظهار النتائج 📊').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [propEmbed], components: [row] });
    }

    // غرفة العمليات المركزية (/mainframe)
    if (commandName === 'mainframe') {
        await interaction.deferReply();
        const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
        const totalVaults = db.prepare('SELECT SUM(vault) as v FROM users').get().v || 0;

        const mainEmbed = new EmbedBuilder()
            .setColor(0x050505)
            .setAuthor({ name: 'NUCLEUS SYSTEM CONTROLLER', iconURL: ASSETS.GOLD_BADGE })
            .setTitle('🖥️ شاشة العمليات المركزية والاحتياطي الفيدرالي')
            .setDescription(
                `\`\`\`asciidoc\n` +
                `[ حالة المنظومة ] :: ALL SYSTEMS OPERATIONAL\n` +
                `[ الأمان والتشفير ] :: AES-256 SECURED\n` +
                `========================================\`\`\``
            )
            .addFields(
                { name: '🏛️ الاحتياطي الفيدرالي', value: '`$5,000,000.00`', inline: true },
                { name: '🔒 إجمالي الودائع المجمدة', value: `\`$${Number(totalVaults).toLocaleString('en-US', { maximumFractionDigits: 0 })}\``, inline: true },
                { name: '👥 الهويات المعتمدة', value: `\`${totalUsers}\` هوية رقمية`, inline: true }
            )
            .setImage(ASSETS.MAINFRAME)
            .setFooter({ text: 'PRIVATE ECOSYSTEM BACKBONE' })
            .setTimestamp();

        return interaction.editReply({ embeds: [mainEmbed] });
    }
});

process.on('unhandledRejection', err => console.error('Error:', err));
client.login(process.env.DISCORD_TOKEN);