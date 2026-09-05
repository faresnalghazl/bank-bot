# 🏦 Discord Central Bank & Financial Trading Bot (V3)

A professional, high-performance financial, banking, and stock market simulation bot built with Node.js, Discord.js v14, and SQLite (better-sqlite3) [cite: 10, 12]. It provides a complete immersive economic ecosystem featuring digital IDs, investment vaults, real-time stock trading, bounties, public auctions, and administrative control panels [cite: 12].

---

## ✨ Features

- 💳 Digital Pass & Identity (/pass): Displays unique citizen ID, join date, available cash, vault savings, and credit trust score inside a stylized financial layout [cite: 10, 12].
- 💼 Portfolio Management (/portfolio, /stocks, /buy, /sell): Track regional and international equity assets (e.g., NVDA, BTC, ARAMCO, AAPL) [cite: 10, 12]. Buy and sell shares dynamically, updating user portfolio holdings and cash balances securely in SQLite [cite: 10, 12].
- 🏛️ Central Bank & Treasury (/bank, /deposit, /transfer): Secure your cash in the financial vault and earn periodic returns [cite: 10, 12]. Send bank-encrypted wire transfers directly to other server members with automatic transaction logs [cite: 10, 12].
- 🎯 Contracts, Auctions & Governance (/bounties, /auction-start, /proposal, /mainframe): Complete daily activity goals and investment contracts [cite: 10, 12]. Host live community auctions for special roles, assets, or items [cite: 10, 12]. Submit investment or community proposals for public voting [cite: 10, 12]. Access the central monitoring dashboard and Federal Reserve oversight for server liquidity and treasury reserves [cite: 10, 12].

---

## 🛠️ Tech Stack & Dependencies

- Runtime: Node.js (v16.11.0+) [cite: 12]
- Library: Discord.js v14 [cite: 10, 12]
- Database: better-sqlite3 [cite: 10, 12]
- Environment Management: dotenv [cite: 10, 12]

---

## 📁 Project Structure

bank-bot/
├── .env                  # Environment configuration (Token, Client ID, Guild ID) [cite: 10, 12]
├── deploy-commands.js    # Slash command registration script (REST API) [cite: 10, 12]
├── index.js              # Core application entry point, database schema, and event handlers [cite: 10, 12]
├── mainframe.db          # Embedded SQLite database (users & treasury records) [cite: 9, 12]
├── package.json          # Project metadata and dependencies [cite: 10, 12]
└── README.txt            # Documentation [cite: 12]

---

## 📦 Installation & Setup

### 1. Install Dependencies
Ensure you have Node.js installed, then run [cite: 12]:

npm install

Or install the required packages manually [cite: 12]:
npm install discord.js better-sqlite3 dotenv

### 2. Configure Environment Variables
Create or verify your .env file in the root directory [cite: 10, 12]:

DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id
GUILD_ID=your_discord_server_id
LOG_CHANNEL_ID=your_audit_log_channel_id

### 3. Deploy Slash Commands
Register application commands to your guild [cite: 12]:

node deploy-commands.js

### 4. Run the Bot
Start the application [cite: 12]:

node index.js

---

## 🎮 Command Reference

| Command | Permission | Description |
| :--- | :--- | :--- |
| /pass [target] | Everyone | Displays investor digital ID and financial card [cite: 10, 12] |
| /portfolio [target] | Everyone | Views owned stocks and asset distribution [cite: 10, 12] |
| /bank | Everyone | Account statement and vault status [cite: 10, 12] |
| /deposit <amount> | Everyone | Deposit cash into the interest-bearing vault [cite: 10, 12] |
| /transfer <target> <amount> | Everyone | Secure bank transfer to another member [cite: 10, 12] |
| /stocks | Everyone | Live stock market ticker and asset prices [cite: 10, 12] |
| /buy <symbol> <shares> | Everyone | Purchase shares from the stock market [cite: 10, 12] |
| /sell <symbol> <shares> | Everyone | Liquidate shares from your portfolio [cite: 10, 12] |
| /auction-start <item> <starting_bid> | Manage Server | Host a live public auction [cite: 10, 12] |
| /bounties | Everyone | Daily investment contracts and task board [cite: 10, 12] |
| /proposal <title> <description> | Everyone | Submit an administrative or investment proposal [cite: 10, 12] |
| /mainframe | Administrator | Central monitoring screen and Federal Reserve liquidity status [cite: 10, 12] |

---

## 🔒 Security Best Practices

- Never share your .env or database credentials [cite: 12]. Keep your bot token secure [cite: 12].
- Ensure your bot has Privileged Gateway Intents (Server Members, Message Content, Guilds) enabled in the Discord Developer Portal [cite: 10, 12].

---

## 📄 License

This project is licensed under the ISC License [cite: 10, 12].
