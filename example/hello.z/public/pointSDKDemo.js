let ws;

pointSDKDemo = {
    websocket: {
        open: (callback) => {
            if (!ws) {
                // TODO route via ZProxy
                ws = new WebSocket('ws://localhost:2469/ws/node')
                ws.onmessage = (msg) => callback(msg.data);
            }
        }
    },
    status: {
        ping: async () => {
            let response = await fetch('/v1/api/status/ping')
            return await response.json()
        }
    },
    wallet: {
        address: async () => {
            let address = await fetch('/v1/api/wallet/address')
            return await address.json()
        },
        balance: async () => {
            let balance = await fetch('/v1/api/wallet/balance')
            return await balance.json()
        },
        hash: async () => {
            let hash = await fetch('/v1/api/wallet/hash')
            return await hash.json()
        },
    },
    contract: {
        call: async (meta) => {
            let response = await fetch('/v1/api/contract/call', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(meta)
            })
            return await response.json()
        },
        send: async (meta) => {
            let response = await fetch('/v1/api/contract/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(meta)
            })
            return await response.json()
        },
        // load: async(contractName) => {
        //     ///v1/api/contract/load/Hello
        //     console.log(window.location)
        //     let contract = await fetch(`${window.location}v1/api/contract/load/${contractName}`, {
        //         headers: {
        //             Host: window.location
        //         }
        //     })
        //     return await contract.json()
        // },
        subscribe: async(meta) => {
            let payload = {
                type: 'subscribeContractEvent',
                params: meta
            }
            ws.send(JSON.stringify(payload))
        }
    }
}

window.point = pointSDKDemo