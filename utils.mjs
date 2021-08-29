import {ApiPromise, WsProvider} from '@polkadot/api';
import {Client as WebSocket} from 'rpc-websockets';
import {bnToBn} from "@polkadot/util";

export const convert = (from, to) => str => Buffer.from(str, from).toString(to)
export const utf8ToHex = convert('utf8', 'hex')
export const hexToUtf8 = convert('hex', 'utf8')
export const unit = bnToBn('1000000000000000');


export function sleep(milliseconds) {
	return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export function waitTx(moduleMetadata) {
	let signal = false;
	return [
		({events = [], status}) => {
			// console.log(JSON.stringify(status));
			// if (status.isFinalized) {
			if (status.isInBlock) {
				// console.log('%s BlockHash(%s)', status.type, status.asFinalized.toHex());
				console.log('%s BlockHash(%s)', status.type, status.asInBlock.toHex());
				events.forEach(({phase, event: {data, method, section}}) => {
					if ("system.ExtrinsicFailed" === section + '.' + method) {
						let processed = false;
						for (let d of data) {
							if (d.isModule) {
								let mErr = d.asModule;
								let module = moduleMetadata[mErr.index];
								console.log("error: %s.%s", module.name, module.errors[mErr.error].name);
								processed = true;
							}
						}
						if (!processed) {
							console.log("event: " + phase.toString() + ' ' + section + '.' + method + ' ' + data.toString());
						}
					} else if ("system.ExtrinsicSuccess" === section + '.' + method) {
						// ignore
					} else if ("proxy.ProxyExecuted" === section + '.' + method) {
						// console.log(data.toString());
						for (let d of data) {
							d = d.toJSON();
							if (d.Err && d.Err.Module && d.Err.Module.index && d.Err.Module.error) {
								let module = moduleMetadata[d.Err.Module.index];
								console.log("proxy.ProxyExecuted: %s.%s", module.name, module.errors[d.Err.Module.error].name);
							} else {
								console.log("event: " + phase.toString() + ' ' + section + '.' + method + ' ' + data.toString());
							}
						}
					} else if("bridge.Desposit" === section + '.' + method){
						console.log("event0: " + phase.toString() + ' --' + section + '.' + method + ' ' + data.toString());
					}else {

						console.log("event1: " + phase.toString() + ' --' + section + '.' + method + ' ' + data.toString());
					}
				});
				signal = true;
			}
		},
		async function () {
			for (; ;) {
				await sleep(100);
				if (signal) break;
			}
		}
	];
}

export async function getApi(dest) {
	// https://github.com/elpheria/rpc-websockets/blob/master/API.md#new-websocketaddress-options---client
	const ws = new WebSocket(dest, {max_reconnects: 0});
	let connected = false;
	ws.on('open', function () {
		process.on('unhandledRejection', error => {
			console.log('global error handle: ', error.message);
		});
		connected = true;
	});
	const provider = new WsProvider(dest);

	const types = {
		"SwapPair": {
			"account": "AccountId",
			"nativeReserve": "Balance",
			"assetReserve": "TAssetBalance"
		},
		"TAssetBalance": "u128",
		"TagCoefficient": "u8",
		"TagType": "u8",
		"TagScore": "i8",
		"Public": "MultiSigner",
		"AdvertiserOf": "Advertiser",
		"AdvertisementOf": "Advertisement",
		"AdvertiserId": "GlobalId",
		"DepositNonce": "u64",
		"DidMethodSpecId": "[u8; 20]",
		"GlobalId": "u64",
		"NativeBalance": "Balance",
		"SwapAssetBalance": "TAssetBalance",
		"AdId": "GlobalId",
		"Address": "MultiAddress",
		"LookupSource": "MultiAddress",
		"Did":"Vec<u8>",
		"ChainId": "u32",
		"TAssetBalance": "u128",

		"ExternalAddress":{
			"btc":"Vec<u8>",
			"eth":"Vec<u8>",
			"eos":"Vec<u8>"
		},
		"LockedRecords":{
			"locked_time":"Moment",
			"locked_period":"Moment",
			"locked_funds":"Balance",
			"rewards_ratio":"u64",
			"max_quota":"u64"
		},
		"UnlockedRecords":{
			"unlocked_time":"Moment",
			"unlocked_funds":"Balance"
		},
		"MetadataRecord":{
			"address":"AccountId",
			"superior":"Hash",
			"creator":"AccountId",
			"did":"Did",
			"locked_records":"Option<LockedRecords<Balance, Moment>>",
			"unlocked_records":"Option<UnlockedRecords<Balance, Moment>>",
			"donate":"Option<Balance>",
			"social_account":"Option<Hash>",
			"subordinate_count":"u64",
			"group_name":"Option<Vec<u8>>",
			"external_address":"ExternalAddress"
		},
		"AdsLinkedItem":{
			"prev":"Option<AdIndex>",
			"next":"Option<AdIndex>"
		},
		"ActiveIndex":"u64",
		"AdIndex":"u64",
		"DistributeType":{
			"_enum":[
				"ADVERTISER",
				"AGENT"
			]
		},
		"ResourceId": "AccountId",
		"AdsMetadata":{
			"advertiser":"Vec<u8>",
			"topic":"Vec<u8>",
			"total_amount":"Balance",
			"spend_amount":"Balance",
			"single_click_fee":"Balance",
			"display_page":"Vec<u8>",
			"landing_page":"Option<Vec<u8>>",
			"create_time":"Moment",
			"active":"Option<ActiveIndex>",
			"distribute_type":"DistributeType"
		},
		"EventHTLC":{
			"eth_contract_addr":"Vec<u8>",
			"htlc_block_number":"BlockNumber",
			"event_block_number":"BlockNumber",
			"expire_height":"u32",
			"random_number_hash":"Vec<u8>",
			"swap_id":"Hash",
			"sender_addr":"Vec<u8>",
			"sender_chain_type":"HTLCChain",
			"receiver_addr":"Hash",
			"receiver_chain_type":"HTLCChain",
			"recipient_addr":"Vec<u8>",
			"out_amount":"Balance",
			"event_type":"HTLCType"
		},
		"HTLCChain":{
			"_enum":[
				"ETHMain",
				"PRM"
			]
		},
		"HTLCStates":{
			"_enum":[
				"INVALID",
				"OPEN",
				"COMPLETED",
				"EXPIRED"
			]
		},
		"EventLogSource":{
			"event_name":"Vec<u8>",
			"event_url":"Vec<u8>",
			"event_data":"Vec<u8>"
		},
		"HTLCType":{
			"_enum":[
				"HTLC",
				"Claimed",
				"Refunded"
			]
		},
		"Erc20EventTransfer":{
			"value": "Compact<Balance>",
			"from": "Vec<u8>"
		},
		"Erc20EventWithdraw" :{
			"value": "Compact<Balance>",
			"who": "Vec<u8>",
			"status": "bool"
		},
		"Erc20EventRedeem" :{
			"value": "Compact<Balance>",
			"from": "Vec<u8>",
			"to": "AccountId"
		},
		"Erc20EventDesposit":{
			"from": "Vec<u8>",
			"to": "AccountId",
			"value": "Compact<Balance>"
	
		},
		"Erc20Event": {
			"_enum": {
				"Transfer": "Erc20EventTransfer",
				"Withdraw": "Erc20EventWithdraw",
				"Redeem": "Erc20EventRedeem",
				"Desposit": "Erc20EventDesposit"
			}
		}
	};

	const api = await ApiPromise.create({provider, types});
	const [chain, nodeName, nodeVersion] = await Promise.all([
		api.rpc.system.chain(),
		api.rpc.system.name(),
		api.rpc.system.version()
	]);
	console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);
	api.ws = ws;
	while (!connected) {
		await sleep(300);
	}
	console.log("ws client has connected to %s", dest);
	return api;
}

export function secondsToString(seconds) {
	let numyears = Math.floor(seconds / 31536000);
	let numdays = Math.floor((seconds % 31536000) / 86400);
	let numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
	let numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
	let numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
	return numyears + " years " + numdays + " days " + numhours + " hours " + numminutes + " minutes " + Math.round(numseconds) + " seconds";
}

export async function getModules(api) {
	let metadata = await api.rpc.state.getMetadata();
	metadata = metadata.asLatest.modules;
	metadata.index = {};
	for (const a of metadata) {
		metadata.index[a.index] = a;
		// console.log(a.index.toString());
	}
	return metadata;
}

export function showStorage(s, verbose) {
	console.log("********** storage ***************")
	// noinspection JSUnresolvedVariable
	if (!s.isNone) {
		let storage = s.unwrap();
		console.log("prefix in key-value databases: [%s]", storage.prefix);
		for (let s of storage.items) {
			// noinspection JSUnresolvedVariable
			console.log("%s: modifier[%s] %s", s.name, s.modifier, s.documentation[0]);
			if (verbose) console.log(s.toHuman());
		}
	}
}

export function showCalls(s, verbose) {
	console.log("********** calls ***************")
	// noinspection JSUnresolvedVariable
	if (!s.isNone) {
		let calls = s.unwrap();
		for (let s of calls) {
			// noinspection JSUnresolvedVariable
			console.log("%s: %s", s.name, s.documentation[0]);
			if (verbose) console.log(s.toHuman());
		}
	}
}

export function showErrors(errors, verbose) {
	console.log("********** errors ***************")
	// noinspection JSUnresolvedVariable
	for (let e of errors) {
		// noinspection JSUnresolvedVariable
		console.log("%s: %s", e.name, e.documentation[0]);
		if (verbose) console.log(e.toHuman());
	}
}

export function showEvents(e, verbose) {
	console.log("********** events ***************")
	// noinspection JSUnresolvedVariable
	if (!e.isNone) {
		let events = e.unwrap();
		for (let e of events) {
			// noinspection JSUnresolvedVariable
			console.log("%s: %s", e.name, e.documentation[0]);
			if (verbose) console.log(e.toHuman());
		}
	}
}

export function showConstants(constants) {
	console.log("********** constants ***************")
	for (let c of constants) {
		// noinspection JSUnresolvedVariable
		console.log("%s %s = %s", c.type, c.name, c.documentation);
	}
}

export function findModule(name, moduleMetadata) {
	for (let module of moduleMetadata) {
		// console.log(module.name.toHuman());
		if (name === module.name.toHuman()) {
			return module;
		}
	}
	return {};
}

export function findConstantFrom(name, module) {
	for (let c of module['constants']) {
		// console.log(module.name.toHuman());
		if (name === c.name.toHuman()) {
			return c;
		}
	}
	return {};
}

export function reverseEndian(x) {
	let buf = Buffer.allocUnsafe(4)
	buf.writeUIntLE(x, 0, 4)
	return buf.readUIntBE(0, 4)
}

export async function getEventsByNumber(api, num) {
	const hash = await api.rpc.chain.getBlockHash(num);
	const events = await api.query.system.events.at(hash);
	// noinspection JSUnresolvedFunction
	return [hash.toHex(), events];
}

export async function getExtrinsicByNumber(api, num) {
	const hash = await api.rpc.chain.getBlockHash(num);
	return api.rpc.chain.getBlock(hash);
	// block.block.extrinsics.forEach((ex, index) => {
	//     console.log(index, ex.method);
	// });
}
