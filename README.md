# Point Network
===============

### How to run the demo

It's very raw prototype code, so you have to do lots of things manually right now.

1. Install using npm:

    ```
    npm i
    ```

1. Start your private Ethereum-compatible web3 provider/blockchain on port `7545` ([Ganache](https://www.trufflesuite.com/ganache) is recommended) and use a `mnemonic` like so:

    ```
    ganache-cli -p 7545 -m 'theme narrow finger canal enact photo census miss economy hotel often'
    ```

1. Put the demo configs in their places in your home directory:

    ```
    ./point demo
    ```

1. cd to the `truffle` directory and deploy smart contracts:
    ```
    cd truffle
    truffle deploy --network development
    ```

1. Note the addresses at which the contracts were deployed and put them into [resources/defaultConfig.json](./resources/defaultConfig.json): `network/identity_contract_address`

1. Create the `data/db` directories for each demo:

    ```
    mkdir -p ~/.point/test1/data/db
    mkdir -p ~/.point/test2/data/db
    mkdir -p ~/.point/test3/data/db
    ```

1. Run the nodes in different tabs

    ```
    ./point --datadir ~/.point/test1 -v
    ./point --datadir ~/.point/test2 -v
    ./point --datadir ~/.point/test3 -v
    ```

1. [Download and Run the Raiden Wizard](https://docs.raiden.network/installation/quick-start/download-and-run-the-raiden-wizard#download-the-raiden-wizard). This will install, setup and automatically start a private Raiden Node on your computer connected to Goerli Testnet. Be patient - the process can take about 10 minutes!

1. Once started visit [http://localhost:5001/api/v1/address](http://localhost:5001/api/v1/address) to get your private node address (it's also available in the Raiden Web UI at the top).

1. Fund your Raiden Node Address on Goerli testnet with token you plan to use for payment.

1. Update the `storage_provider` address in [StorageProviderRegistry.sol](./truffle/contracts/StorageProviderRegistry.sol) to the address of your private Raiden node.

1. Next [Join a Token Network](https://docs.raiden.network/the-raiden-web-interface/join-a-token-network#registering-a-new-token) that you want to use for payments.

1. Update `token_address` in [resources/defaultConfig.json](./resources/defaultConfig.json) to the address of that token.

1. Now you need to create a second Raiden node for the _deployer_ PN node to use. This needs to be setup either in a separate computer or within a container such as Docker. Specific details to follow soon.

1. Tell the second node to deploy the `example.z` website:

    ```
    ./point deploy example/example.z --datadir ~/.point/test2 -v
    ```

1. Now you can stop the second node (Ctrl+C).
1. Run the [Point Browser](https://github.com/pointnetwork/pointbrowser)
1. Navigate to `http://example.z` and it will open the home page of the Example Blog.

### Troubleshooting the demo

To completely reset the nodes, clear all the cache data and redeploy your config files simply run the following script from the project root folder:

```
./scripts/clear-node.sh
```

If the nodes do not appear to cache all the data then ensure that `client.storage.default_redundancy` setting is set to the number of nodes you have running (3).

If the expected node is not responding with the data requests then ensure that `service_provider.enabled` is set to `false` for that node. Typically for the demo we want to have `Node 1` set to true and the others set to false.

### Quick run

You can run the following scripts in one terminal window which will clear all your nodes cache, redeploy the config to each node, start Ganache, deploy the smart contracts, start 3 nodes and deploy the example site!

```
./scripts/clear-node.sh
./scripts/run-node.sh
```

If you want a bit more control / visibility then below is a set of scripts to run to get 3 nodes up and running in 3 differnet terminal windows and then deploy 3 example sites for testing in the Point Browser. Note: you will need to have your local ganache running and the Point Netowrk contracts deployed (see above).

```
./scripts/clear-node.sh

./point --datadir ~/.point/test1 -v
./point --datadir ~/.point/test2 -v
./point --datadir ~/.point/test3 -v

./point deploy example/example.z --datadir ~/.point/test2 -v
./point deploy example/twitter.z --datadir ~/.point/test2 -v
./point deploy example/hello.z --datadir ~/.point/test2 -v
```

### Run a Point Node in a VS Code Debugger

The VS Code debugger is configured using the [VS Code launch config](.vscode/launch.json) file. Its configured to launch a test node under your `~/.point/test1` directory.

To start the VS Code debugger, click on the debugger button and at the top select `Launch Point Node` from the drop down and hit the _play_ button.

Now you can add breakpoints and run a depolyment from a separate terminal window to hit the breakpoint.

Note that it may fail to start and this is usually due to the `point.pid` file still being present in the `~/.point/test1` directory. Simply delete that file (`rm ~/.point/test1/point.pid`) and run the debugger again.

Note also that the launch config makes use of the `$HOME` environment variable for the `--datadir` param. If you do not have this environment variable set, then you will need to do so and run the debugger again.

Please let us know if you hit any obstacles of encounter errors or bugs by opening an issue or emailing info@pointnetwork.io.

Visit our website at [https://pointnetwork.io/](https://pointnetwork.io/)