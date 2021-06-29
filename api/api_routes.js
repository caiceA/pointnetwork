module.exports = [
    ['GET', '/v1/api/status/ping', 'PingController@ping'],
    ['GET', '/v1/api/status/meta', 'StatusController@meta'],
    ['GET', '/v1/api/deploy', 'DeployController@deploy'],
    ['GET', '/v1/api/storage/files', 'StorageController@files'],
    ['GET', '/v1/api/storage/files/:id', 'StorageController@fileById'],
    ['GET', '/v1/api/storage/chunks', 'StorageController@chunks'],
    ['GET', '/v1/api/storage/chunks/:id', 'StorageController@chunkById'],
    ['GET', '/v1/api/storage/get/:id', 'StorageController@get'],
    ['GET', '/v1/api/wallet/generate', 'WalletController@generate'],
    ['GET', '/v1/api/wallet/publicKey', 'WalletController@publicKey'],
    ['GET', '/v1/api/wallet/balance', 'WalletController@balance'],
    ['GET', '/v1/api/wallet/hash', 'WalletController@hash'],
    ['GET', '/v1/api/wallet/address', 'WalletController@address'],
    ['POST', '/v1/api/wallet/tx', 'WalletController@tx'],
    ['POST', '/v1/api/contract/call', 'ContractController@call'],
    ['POST', '/v1/api/contract/send', 'ContractController@send']
];