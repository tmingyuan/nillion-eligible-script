const { DirectSecp256k1HdWallet } = require("@cosmjs/proto-signing");
const { Secp256k1HdWallet } = require("@cosmjs/amino");
const { toBase64, toUtf8} = require("@cosmjs/encoding");
const { ethers } = require('ethers');

// 替换 XMLHttpRequest
const XHR = require('xhr2');
global.XMLHttpRequest = XHR

// const { HttpsProxyAgent } = require('https-proxy-agent');
// const proxyUrl = 'http://127.0.0.1:7890'; // 动态代理地址
// const proxyAgent = new HttpsProxyAgent(proxyUrl);

const {
  RegistrationRequest, RegistrationResponse,
  DeleteClaimRequest, DeleteClaimResponse,
  AddTermsRequest, CheckTermsRequest, TermsResponse,
  AddIdRequest, DeleteIdRequest,
  AddIdResponse, DeleteIdResponse,
  EligibilityRequest, EligibilityResponse,
  TempVerificationRequest, TempVerificationResponse
} = require('./cao_pb');
const { ContractClient } = require('./cao_grpc_web_pb');
const baseUrl = "https://nildrop-server.production.app-cluster.nillion.network:443";  // grcp 服务器地址
const client = new ContractClient(baseUrl, null, null);

const { readCsvFile } = require('./util/csv');
const { getLogger } = require("./util/log");

const chainId = 'nillion-chain-testnet-1';
const walletOptions = {prefix: 'nillion'};

const logger = getLogger('default');

// 和 Keplr 钱包一样的 signArbitrary  方法, 输入时助记词 和 消息对象
async function signArbitrary(mnemonic, message) {
  message = JSON.stringify(message);
  const signDoc = {
    "chain_id": "",
    "account_number": "0",
    "sequence": "0",
    "fee": {
      "gas": "0",
      "amount": []
    },
    "msgs": [
      {
        "type": "sign/MsgSignData",
        "value": {
          "signer": "",
          "data": toBase64(toUtf8(message)),
        }
      }
    ],
    "memo": ""
  }
  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, walletOptions);
  const [account] = await wallet.getAccounts();
  signDoc.msgs[0].value.signer = account.address;
  return await wallet.signAmino(account.address, signDoc);
}


class WalletProcess {
  constructor(mnemonic) {
    this.mnemonic = mnemonic;
    this.address = null;
  }
  info(msg) {
    logger.info(`Account: ${this.address} | ${msg}`);
  }
  prepareMessage(message) {
    return {
      ...message,
      nonce: Math.random().toString(36),
      ts: Math.floor(Date.now() / 1e3)
    }
  }
  async run(ethPrivateKey) {
    await this.initWallet();
    this.info('Begin Check Eligibility');
    let registerResult = await this.registerKeplrWallet();
    if (registerResult[2] === 'ELIGIBLE') {
      this.info(`已经检查过了， 有资格`);
      return
    }
    if (registerResult[2] === 'INELIGIBLE') {
      this.info(`没有资格`);
      return
    }
    // if (registerResult[1] !== true) {
    //   this.info('注册环节错误，请复制助记词进入浏览器查看');
    //   return
    // }
    await this.acceptTerms()
    if (ethPrivateKey) {
      this.info(`读取到ETH私钥，开始绑定ETH钱包`);
      await this.registerETHWallet(ethPrivateKey);
    }
    let checkResult = await this.checkEligibility();
    this.info(`空投资格检查结果: ${checkResult[0]}`);
  }
  async initWallet() {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, walletOptions);
    const [account] = await wallet.getAccounts();
    this.address = account.address;
  }
  async registerKeplrWallet() {
    this.info('registerKeplrWallet');
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, walletOptions);
    const [account] = await wallet.getAccounts();

    let message = {
      _: "Prove that you control this wallet",
      type: "keplr",
      address: account.address,
    };
    message = this.prepareMessage(message);
    this.info(`Sign Msg: ${JSON.stringify(message)}`);
    const signature = await signArbitrary(this.mnemonic, message);
    this.info(`Sign Result: ${JSON.stringify(signature)}`);
    const request = new RegistrationRequest();
    request.setNillionaddress(account.address);
    request.setPubkeytype(signature.signature.pub_key.type);
    request.setPubkey(signature.signature.pub_key.value);
    return new Promise((resolve, reject) => {
      const call = client.register(request, {},  (err, response) => {
        if (err)  {
          this.info(`Has Error in gRPC: `)
          this.info(err)
          console.error(err);
          reject(err);
          return
        }
        this.info(response.u);
        resolve(response.u);
      });
    })
  }
  async acceptTerms() {
    this.info('acceptTerms');
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, walletOptions);
    const [account] = await wallet.getAccounts();

    let message = {
      _: "Prove that you accept the terms",
      type: "terms-of-service",
      version: 'https://nillion.notion.site/Nillion-airdrop-Ts-Cs-1731827799b480eeb8c3cf8be7ccc4d7',
    }
    message = this.prepareMessage(message);
    this.info(`Sign Msg: ${JSON.stringify(message)}`);
    const signature = await signArbitrary(this.mnemonic, message);
    this.info(`Sign Result: ${JSON.stringify(signature)}`);
    const request = new AddTermsRequest();
    request.setNillionaddress(account.address);
    request.setTermsmsg(JSON.stringify(message));
    request.setSignature(signature.signature.signature);
    return new Promise((resolve, reject) => {
      const call = client.addTerms(request, {},  (err, response) => {
        if (err)  {
          this.info(`Has Error in gRPC: `)
          this.info(err)
          console.error(err);
          reject(err);
          return
        }
        this.info(response.u);
        resolve(response.u);
      });
    })
  }
  async registerETHWallet(ethPrivateKey) {
    this.info('registerETHWallet');
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, walletOptions);
    const [account] = await wallet.getAccounts();
    const nonce = Math.random().toString(36);
    let evmSignMsg = `Sign to prove account ownership for Nillion - ${nonce}`
    this.info(`evmSignMsg: ${evmSignMsg}`);
    const evmWallet = new ethers.Wallet(ethPrivateKey);
    const evmSignResult = await evmWallet.signMessage(evmSignMsg);
    this.info(`evmSignResult: ${evmSignResult}`);

    let message = {
      _: "Prove that you control this wallet",
      type: "erc20",
      account: evmWallet.address, // ethAddress
      chainId: 1, // 1
      signature: evmSignResult // eth sign
    }
    message = this.prepareMessage(message);
    this.info(`Sign Message: ${JSON.stringify(message)}`);
    const signature = await signArbitrary(this.mnemonic, message);
    const request = new AddIdRequest();
    request.setNillionaddress(account.address);
    request.setIdtype('erc20');
    request.setIdmsg(JSON.stringify(message));
    request.setSignature(signature.signature.signature);
    return new Promise((resolve, reject) => {
      const call = client.addId(request, {},  (err, response) => {
        if (err)  {
          console.error('Get ERROR:')
          console.error(err);
          reject(err);
          return
        }
        this.info(response.u);
        resolve(response.u);
      });
    })
  }
  async checkEligibility() {
    this.info('checkEligibility');
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, walletOptions);
    const [account] = await wallet.getAccounts();

    let message = {
      _: "Prove that you control this wallet",
    }
    message = this.prepareMessage(message);
    this.info(`Sign Message: ${JSON.stringify(message)}`);
    const signature = await signArbitrary(this.mnemonic, message);
    const request = new EligibilityRequest();
    request.setNillionaddress(account.address);
    request.setMsg(JSON.stringify(message));
    request.setSignature(signature.signature.signature);
    return new Promise((resolve, reject) => {
      const call = client.eligible(request, {},  (err, response) => {
        if (err)  {
          console.error('Get ERROR:')
          console.error(err);
          reject(err);
          return
        }
        this.info(response.u);
        resolve(response.u);
      });
    })
  }
}


// async function main() {
//   let walletInfos = await readCsvFile('../');
//   for(let i = 0; i < walletInfos.length; i++) {
//     const walletInfo = walletInfos[i];
//   }
// }

// (async () => {
//   let test = 'make camera disagree poverty dilemma air vast extend round spy wire trust';
//   let p = new WalletProcess(test);
//   await p.run()
// })()
// main()

module.exports = {
  WalletProcess
}