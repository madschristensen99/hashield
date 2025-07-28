# 🔄 1Inch Microservice

This microservice acts as a bridge between the PrivateRPC system and the 1inch protocol. It handles the creation of escrows for atomic swaps between ETH and XMR using the SwapCreatorAdapter contract deployed on Base Sepolia.

## 🚀 Features

- Create escrows for atomic swaps
- Predict escrow addresses
- Check escrow status
- Integration with 1inch protocol

## 🛠️ Setup

1. 📦 Clone the repository (if not already done)
2. 🔧 Install dependencies:
   ```bash
   npm install
   ```
3. 🔑 Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Then edit the `.env` file to add your private key and other configuration.

## 💻 Development

Run the service in development mode:

```bash
npm run dev
```

Watch mode (auto-restart on file changes):

```bash
npm run watch
```

## 🏗️ Build

Build the TypeScript code:

```bash
npm run build
```

## 🚀 Production

Run the compiled service:

```bash
npm start
```

## 📝 API Endpoints

### Health Check
```
GET /health
```

### Create Escrow
```
POST /escrow
```

### Predict Escrow Address
```
GET /predict-escrow
```

### Get Escrow Status
```
GET /escrow/:id
```

## 🔄 Integration with SwapCreatorAdapter

This microservice interacts with the SwapCreatorAdapter contract deployed at:
- Base Sepolia: `0x14Ab64a2f29f4921c200280988eea59c85266A33`

The SwapCreatorAdapter in turn interacts with the SwapCreator contract at:
- Base Sepolia: `0x07b9c8BF96E553Adec406cC6ab8c41CCD3d53a51`

## 🧪 Testing

```bash
npm test
```

## 📚 TODO

- Implement full escrow creation logic
- Add proper error handling and logging
- Implement authentication and security measures
- Add comprehensive test suite
- Integrate with 1inch API for price quotes
