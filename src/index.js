
const { WalletProcess } = require('./register');


const { readCsvFile } = require('./util/csv');

async function main() {
  let walletInfos = await readCsvFile('../data/browserWallet.csv');
  let evmWalletInfos = await readCsvFile('../data/evmWallet.csv');

  console.log(`读取到 Nillion 钱包数量: ${walletInfos.length}`);
  console.log(`读取到 EVM 钱包数量: ${evmWalletInfos.length}`);

  for(let i = 0; i < walletInfos.length; i++) {
    const walletInfo = walletInfos[i];
    const mnemonic = walletInfo.mnemonic;
    const evmWalletInfo = evmWalletInfos[i] || {};
    let process = new WalletProcess(mnemonic);
    await process.run(evmWalletInfo.privateKey)
  }
}

main()