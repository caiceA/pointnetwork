const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const events = require('events')
let ethereumjs = require('ethereumjs-util')

class Wallet {
    constructor(ctx) {
        this.ctx = ctx;
        this.config = ctx.config.client.wallet;
        this.network_account = this.config.account;
        this.web3 = this.ctx.network.web3;

        // Events
        this.TRANSACTION_EVENT = 'TRANSACTION_EVENT'
        this.transactionEventEmitter = new events.EventEmitter()
        this._initEventHandlerFunction()
    }

    async start() {
        this.keystore_path = path.join(this.ctx.datadir, this.config.keystore_path);
        if (! fs.existsSync(this.keystore_path)) {
            mkdirp.sync(this.keystore_path);
        }

        // todo: other setup?
    }

    // this is set by the WalletConnectSocket once a connection is established with a client
    set wss(_wss) {
        this.wsserver = _wss
    }

    _initEventHandlerFunction() {
        this.transactionEventEmitter.on(this.TRANSACTION_EVENT, (transactionHash, from, to, value) => {
            if (this.wsserver) {
                let payload = {
                    data: {
                        transactionHash: transactionHash,
                        from,
                        to,
                        value
                    }
                }
                this.wsserver.publishToClients(payload)
            }
        })
    }

    async sendTransaction(from, to, value) {
        let receipt = await this.web3.eth.sendTransaction({from: from, to: to, value: value, gas: 21000})
        this.transactionEventEmitter.emit(this.TRANSACTION_EVENT, receipt.transactionHash, from, to, value)
        return receipt
    }

    generate(passcode) {
        let account = this.web3.eth.accounts.create(this.web3.utils.randomHex(32))
        let wallet = this.web3.eth.accounts.wallet.add(account);

        let keystore = wallet.encrypt(passcode);

        // write the encrypted wallet to disk
        fs.writeFileSync(`${this.keystore_path}/${keystore.id}`, JSON.stringify(keystore))

        // TODO: remove
        this._fundWallet(account.address)

        return keystore.id
    }

    loadWalletFromKeystore(walletId, passcode) {
        // todo what if it does not exist?
        let keystoreBuffer = fs.readFileSync(`${this.keystore_path}/${walletId}`)
        let keystore = JSON.parse(keystoreBuffer)

        // decrypt it using the passcode
        let decryptedWallets = this.web3.eth.accounts.wallet.decrypt([keystore], passcode);

        let address = ethereumjs.addHexPrefix(keystore.address)

        return decryptedWallets[address] // return the wallet using the address in the loaded keystore
    }

    async getNetworkAccountBalanceInWei() {
        return await this.web3.eth.getBalance(this.network_account);
    }

    getNetworkAccountPrivateKey() {
        // todo: Use keystore instead of config!!!
        return this.config.privateKey;
    }

    getNetworkAccount() {
        return this.network_account;
    }

    // todo: remove
    _fundWallet(_address) {
        this.web3.eth.sendTransaction({from: this.network_account, to: _address, value: 1e18, gas: 21000})
    }
}

module.exports = Wallet;