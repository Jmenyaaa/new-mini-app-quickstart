# 📋 Инструкции по развёртыванию NFT Контракта на Base

## 1️⃣ Установка зависимостей

```bash
npm install hardhat @openzeppelin/contracts ethers
npx hardhat
```

## 2️⃣ Настройка Hardhat

Создай файл `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453,
    },
    baseTestnet: {
      url: "https://sepolia.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84532,
    },
  },
};
```

## 3️⃣ Переменные окружения

Создай файл `.env`:

```
PRIVATE_KEY=your_wallet_private_key
NFT_STORAGE_TOKEN=your_nft_storage_token
BASE_CONTRACT_ADDRESS=deployed_contract_address
```

## 4️⃣ Развёртывание контракта

```bash
# На тестовой сети (Sepolia Base)
npx hardhat run scripts/deploy.js --network baseTestnet

# На основной сети Base
npx hardhat run scripts/deploy.js --network base
```

## 5️⃣ Получение NFT.storage токена

1. Перейди на https://nft.storage
2. Зарегистрируйся бесплатно
3. Создай API ключ
4. Добавь его в `.env` как `NFT_STORAGE_TOKEN`

## 6️⃣ Ссылки для тестирования

- **Base Mainnet**: https://basescan.org
- **Base Sepolia Testnet**: https://sepolia.basescan.org
- **Base Docs**: https://docs.base.org

## 7️⃣ Получение тестовых токенов

Для тестирования используй:
- **Sepolia Faucet**: https://www.alchemy.com/faucets/base-sepolia

## 8️⃣ Интеграция в приложение

Обнови переменную окружения в `.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=8453 (или 84532 для тестовой сети)
NFT_STORAGE_TOKEN=your_token
```

После этого компонент NFTMinter будет готов к минту! 🚀
