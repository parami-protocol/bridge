import {getApi, getModules, waitTx, unit} from "./utils.mjs";
import {Keyring} from "@polkadot/api";
import {bnToBn} from "@polkadot/util";
import {Command} from "commander";

function main() {
	const ss58Format = 42;
	const keyring = new Keyring({type: 'sr25519', ss58Format});
	const program = new Command();
	program.option('--ws <port>', 'node ws addr', 'ws://104.131.189.90:6969');

	program.command('transfer <from> <to>').action(async (from, to) => {
		await demo_transfer(program.opts().ws, keyring, from, to);
	});
	program.command('show-all').action(async () => {
		await demo_show_all(program.opts().ws, keyring);
	});
	program.command('show <account>').action(async (account) => {
		await demo_show(program.opts().ws, keyring, account);
	});
	program.parse();
}

async function demo_show(ws, keyring, account) {
	let api = await getApi(ws);
	let addr = '';
	if (account.length === 48) {
		addr = account;
	} else {
		addr = keyring.addFromUri(account).address;
	}
	account = await api.query.system.account(addr)
	console.log(addr, account.toHuman());
	process.exit();
}

async function demo_show_all(ws, keyring) {
	let api = await getApi(ws);
	const all = await api.query.system.account.entries();
	for (const account of all) {
		let key = account[0];
		const len = key.length;
		key = key.buffer.slice(len - 32, len);
		const addr = keyring.encodeAddress(new Uint8Array(key));
		let data = account[1].toHuman();
		data.address = addr;
		console.log("%s", JSON.stringify(data));
	}
	process.exit();
}

async function demo_transfer(ws, keyring, from, to) {
	let api = await getApi(ws);
	let moduleMetadata = await getModules(api);
	from = keyring.addFromUri(from);
	to = keyring.addFromUri(to).address;
	let [a, b] = waitTx(moduleMetadata);
	await api.tx.balances.transfer(to, bnToBn(10000).mul(unit)).signAndSend(from, a);
	await b();
	process.exit();
}

main()
