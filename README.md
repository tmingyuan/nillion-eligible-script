
Nillion 项目   https://claims.nillion.com/  交互脚本。 

用来检查&注册空投资格。

核心：
1. 提取 proto 定义
2. 使用 grpc-web 通信
3. 实现 signArbitrary 签名
4. 支持 http 代理

使用：
1. data/browserWallet.csv 文件里配置 nillion 地址的助记词
2. data/evmWallet.csv 文件配置 质押过的ETH钱包的私钥， 支持数量不匹配，支持为空。程序将按顺序对应 nillion钱包和evm私钥
3. data/proxy.txt 文件里配置http代理地址，不用代理文件为空


nillion claim 站点拒绝中国大陆和美国地区，注意VPN配置。