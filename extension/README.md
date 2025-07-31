# Hashield

**Privacy-by-default Web3 Browser Extension with Monero Integration**

Hashield is a browser extension that enables Web3 interactions with privacy by default. It provides fresh addresses for each transaction while ensuring privacy and security. Additionally, Hashield features Monero wallet integration for enhanced privacy.

## Features

### 🔐 Privacy by Default
- **Session-based addresses**: Each dApp interaction uses a new address by default, preventing transaction linking and protecting user privacy
- **Address spoofing**: Optional feature to spoof fake rich addresses to dApps for enhanced functionality

### 💰 Private Fund Management
- **Privacy-focused**: Secure management of funds with privacy in mind
- **Automatic funding**: Session wallets can be automatically funded as needed for transactions

### 🌐 Cross-Chain Compatibility
- **Ethereum support**: Native support for Ethereum transactions
- **Multi-chain potential**: Architecture designed for future multi-chain support

### 🔒 Monero Integration
- **Deterministic Monero wallet**: Generate a Monero wallet deterministically from your Ethereum seed phrase
- **Monero transactions**: Send and receive XMR with enhanced privacy
- **Subaddress support**: Create and manage Monero subaddresses

### 🎯 User Experience
The extension requires no effort to the users. Privacy is not something they have to learn how to do, it's
just built in.

## How to Run the Extension

### Prerequisites
- Chrome or Chromium-based browser
- Node.js (v16 or higher)
- A 12-word seed phrase with testnet funds

### Installation Steps

#### Option 1: Direct Installation (Recommended)
1. **Clone the repository**
   ```bash
   git clone https://github.com/madschristensen99/hashield.git
   cd hashield/extension
   ```

2. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist/` folder from the project directory

#### Option 2: Build from Source
1. **Clone the repository**
   ```bash
   git clone https://github.com/madschristensen99/hashield.git
   cd hashield/extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist/` folder from the project directory

5. **Setup your wallet**
   - Click the Hashield extension icon
   - Enter your 12-word seed phrase
   - You're ready to use Web3 with privacy!

### Usage
- Navigate to any Web3 dApp (Uniswap works well)
- Connect your wallet (Hashield will provide a fresh address, and spoof a rich user (can be turned off))
- Approve transactions through the extension popup
- Monitor transaction progress in real-time

## Security Considerations

- **Testnet only**: This is a proof of concept for testnet demonstration. DO NOT USE WITH YOUR REAL SEED PHRASE.
- **Seed phrase security**: Store your seed phrase securely; it controls all derived addresses
- **Deterministic addresses**: Both Ethereum and Monero addresses are derived from the same seed phrase

---

Hashield demonstrates privacy-preserving Web3 interactions through fresh address generation and Monero integration, showcasing the potential for mainstream privacy adoption in blockchain applications.
