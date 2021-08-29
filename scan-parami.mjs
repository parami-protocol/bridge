import {Command} from "commander";
import {getApi, getModules, waitTx} from "./utils.mjs";
import {sleep} from "./utils.mjs";
import Web3 from 'web3';
import {promises as fs} from 'fs';

let txs = []

//交易对象
class BridgeTx {

    constructor(ethAddress, amount, index, blockNum) {
        this.ethAddress = ethAddress,
            this.amount = amount,
            this.index = index,
            this.status = true
        this.blockNum = blockNum
    }

    setStatus() {
        this.status = false
    }

}

async function main() {
    const program = new Command();
    program.command('scan <from_block>')
        .requiredOption('--web3url <url>', 'web3 url. e.g. https://mainnet.infura.io/v3/your-projectId')
        .requiredOption('--contract <contract>', 'contract address', "contract address")
        .requiredOption('--ethHotWallet <ethHotWallet>', 'ethereum hotwallet address', "your contract admin address")
        .requiredOption('--config <config>', 'path of config file', "./config.json")
        .requiredOption('--parami <parami>', 'ws address of parami', "parami address")
        .requiredOption('--pk <privateKey>', 'eth contract admin private key', "your contract admin private key")
        .action(async (from_block, args) => {
            await scan(args, Number(from_block));
        });
    await program.parseAsync(process.argv);
}
/** 
 *  scan block 
 * @param opts 
 * @param api 
 * @param blockNum 
 */
let scanBlock = async function scanBlock(api) {

    const blockHash = await api.rpc.chain.getFinalizedHead();
    const signedBlock = await api.rpc.chain.getBlock(blockHash);

    console.log("blockHash", blockHash.toString(), "signedBlock", JSON.stringify(signedBlock.block.header.number))

    signedBlock.block.extrinsics.forEach((ex, index) => {

   const {isSigned, method: {args, method, section}} = ex;
        if (isSigned && "bridge.desposit" === section + "." + method) {
            console.log(`signer=${ex.signer.toString()}, nonce=${ex.nonce.toString()}   ${args[0]}   ${args[1]}`);
            txs.push(new BridgeTx(args[0].toString(), args[1].toString(), index, signedBlock.block.header.number.toString()))
        }
    });

}

let sendTx=async function (tx, contract, contractAddress, address, privateKey, web3) {
    let gasprice =await web3.eth.getGasPrice();
    const rawTx = {
        "from": address,
        "to": contractAddress,
        "gasPrice": gasprice,
        "gasLimit": web3.utils.toHex("519990"),
        "value": "0x0",
        "data": contract.methods.mint(tx.ethAddress, web3.utils.toHex(tx.amount), web3.utils.toHex(tx.index), web3.utils.toHex(tx.blockNum)).encodeABI(),
        "chainId": 0x04  //need modify by actual env
    };

    const signedTx = await web3.eth.accounts.signTransaction(rawTx, privateKey)
    console.log(signedTx.rawTransaction)
    let res = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(res)

}
let from_block=0;
async function scan(opts) {
    console.log(opts)
    const web3 = new Web3(opts.web3url);
// web3.eth.transactionConfirmationBlocks = 50;

    const contract = new web3.eth.Contract(JSON.parse((await fs.readFile('ad3/abis/ad1.json')).toString()), opts.contract);



    opts.depth = Number(opts.depth);

    let api = await getApi(opts.parami);

    let tx = undefined;
 
    for (; ;) {

        try {
             const blockHash = await api.rpc.chain.getFinalizedHead();
             const header =  await api.rpc.chain.getHeader(blockHash)
             let bestBlockNum = header.number.toString()
                if (bestBlockNum-from_block >1){
                    from_block=bestBlockNum;
                };
            try {
                while (tx = txs.shift()) {
                    sendTx(tx, contract, opts.contract, opts.ethHotWallet, opts.pk, web3, (data) => {
                        console.log("success:", data)
                    });
                }
            } catch (e) {
                console.log("fail", tx, contract, opts.contract, opts.ethHotWallet, opts.pk, web3);
            }
            console.log("..",from_block,bestBlockNum)
           if(from_block <=bestBlockNum){
            await scanBlock(api);
      
            from_block++;
           }else{
            await sleep(500);
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