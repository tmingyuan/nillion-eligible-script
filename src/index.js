
const { WalletProcess } = require('./register');
const { readCsvFile } = require('./util/csv');
const fs = require('fs').promises;

const { HttpsProxyAgent } = require('https-proxy-agent');

const XHR = require('xhr2');
global.XMLHttpRequest = XHR


async function main() {
  let proxyUrl = await fs.readFile('../data/proxy.txt')
  proxyUrl = proxyUrl.toString().trim();
  console.log('proxyUrl', proxyUrl);
  if (proxyUrl !== '') {
    const proxyAgent = new HttpsProxyAgent(proxyUrl);
    XHR.nodejsSet({
      httpAgent: proxyAgent,
      httpsAgent: proxyAgent,
    })
  }
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