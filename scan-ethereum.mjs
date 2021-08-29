import {Command} from "commander";
import {getApi, getModules, waitTx} from "./utils.mjs";
import {Keyring} from "@polkadot/api";
import {sleep} from "./utils.mjs";
import Web3 from 'web3';
import {promises as fs} from 'fs';

async function main() {
    // https://github.com/tj/commander.js/
    const program = new Command();
    program.command('scan <from_block>')
        .requiredOption('--web3url <url>', 'web3 url. e.g. https://mainnet.infura.io/v3/your-projectId')
        .requiredOption('--depth <depth>', 'block depth', "12")
        .requiredOption('--contract <contract>', 'contract address', "your contract address")
        .requiredOption('--ethHotWallet <ethHotWallet>', 'ethereum hotwallet address', "your contract admin addr")
        .requiredOption('--config <config>', 'path of config file', "./config.json")
        .requiredOption('--parami <parami>', 'ws address of parami', "param ws address")
        .action(async (from_block, args) => {
            await scan(args, Number(from_block));
        });
    await program.parseAsync(process.argv);
}

async function scanBlock(opts, api, moduleMetadata, admin, web3, contract, blockNum) {
    let [a, b] = [null, null];
    let txInParami = null;
    // https://blockchain.oodles.io/dev-blog/event-listeners-in-web3-js/
    // const a = await contract.methods.balanceOf("0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503").call();
    let events = await contract.getPastEvents({filter: {}, fromBlock: blockNum, toBlock: blockNum});
    for (let event of events) {
        // console.log(event);
        switch (event.event) {
            case 'Transfer':
                // Sending multiple extrinsics with the same parameters is no harmed.
                // But for the sake of speeding up eth rescanning, we should check
                // the existence of `event.transactionHash` in Parami chain.
                txInParami = await api.query.bridge.erc20Txs(event.transactionHash);
                if (txInParami.isNone && event.returnValues.to.toLowerCase() === opts.ethHotWallet.toLowerCase()) {
                    // [a, b] = waitTx(moduleMetadata);
                    // await api.tx.bridge.transfer(
                    //     event.transactionHash,
                    //     event.returnValues.from,
                    //     event.returnValues.value,
                    // ).signAndSend(admin, a);
                    // await b();
                }
                break;
            case 'Withdraw': // Withdraw(ethAccount, ss58formatAddress, amountOfAD3)
                // Sending multiple extrinsics with the same parameters is no harmed.
                // But for the sake of speeding up eth rescanning, we should check
                // the existence of `event.transactionHash` in Parami chain.
                txInParami = await api.query.bridge.erc20Txs(event.transactionHash);
                if (txInParami.isNone) {
                    // [a, b] = waitTx(moduleMetadata);
                    // await api.tx.bridge.withdraw(
                    //     event.transactionHash,
                    //     event.returnValues.from,
                    //     event.returnValues.to,
                    //     event.returnValues.value,
                    // ).signAndSend(admin, a);
                    // await b();
                }
                break;
            case 'Redeem':
                // Sending multiple extrinsics with the same parameters is no harmed.
                // But for the sake of speeding up eth rescanning, we should check
                // the existence of `event.transactionHash` in Parami chain.
                txInParami = await api.query.bridge.erc20Txs(event.transactionHash);
                if (txInParami.isNone) {
                    console.log( event.returnValues.from,  event.returnValues.to,event.returnValues.value);
                    [a, b] = waitTx(moduleMetadata);
                    console.log(a,b)

                    await api.tx.bridge.redeem(
                        event.transactionHash,
                        event.returnValues.from,
                        event.returnValues.to,
                        event.returnValues.value,
                    ).signAndSend(admin, a);
                    await b();
                }
                break;
            default:
                break;
        }
    }
}

async function scan(opts, from_block) {
    const web3 = new Web3(opts.web3url);
    // web3.eth.transactionConfirmationBlocks = 50;
    const contract = new web3.eth.Contract(JSON.parse((await fs.readFile('ad3/abis/ad3.json')).toString()), opts.contract);
    opts.depth = Number(opts.depth);

    let api = await getApi(opts.parami);
    const keyring = new Keyring({type: 'sr25519', ss58Format: 42});
    let moduleMetadata = await getModules(api);
    const config = JSON.parse((await fs.readFile(opts.config)).toString());
    const admin = keyring.addFromUri(config.admin);

    const runtimeFilePath = './runtime_data.json';
    if (from_block === 0) {
        try {
            const runtimeData = JSON.parse((await fs.readFile(runtimeFilePath)).toString());
            from_block = runtimeData.from_block;
            console.log("continue to scan eth from %s", from_block);
        } catch (_e) {
        }
    }

    for (; ;) {
        try {
            // get the newest block number.
            let bestBlockNum = await web3.eth.getBlockNumber();

            if (from_block === 0) {
                // https://etherscan.io/chart/blocktime
                // rescan from about 1 day ago. 14 secs per block.
                from_block = bestBlockNum - 6000;
            }

            if (from_block <= bestBlockNum - opts.depth) {
                console.log("bestBlockNum %s, targetBlockNum %s", bestBlockNum, from_block);
                await scanBlock(opts, api, moduleMetadata, admin, web3, contract, from_block);
                await fs.writeFile(runtimeFilePath, JSON.stringify({from_block}));
                from_block++;
            } else {
                await sleep(200);
            }
        } catch (e) {
            console.log(e);
            await sleep(2000)
        }
    }
}

main().then(r => {
    console.log("ok");
}).catch(err => {
    console.log(err);
});

