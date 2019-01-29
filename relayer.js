#!/usr/bin/env node

const Web3 = require('web3');
const request = require('request');

/* 
 *  Usage:  Subscribe to Geth node and push header to syscoin via RPC 
 *
 */

let argv = require('yargs')
     .usage('Usage: $0 -sysrpcuser [username] -sysrpcpw [password] -sysrpcport [port] -ethwsport [port]')
     .default("sysrpcport", 18369)
     .default("ethwsport", 8546)
     .default("sysrpcuser", "u")
     .default("sysrpcpw", "p")
     .argv
;
if (argv.sysrpcport < 0 || argv.sysrpcport > 65535) {
    console.log('Invalid Syscoin RPC port');
    exit();
}
if (argv.ethwsport < 0 || argv.ethwsport > 65535) {
		console.log('Invalid Geth RPC port');
		exit();
}
const sysrpcport = argv.sysrpcport;
const ethwsport = argv.ethwsport;
const sysrpcuser = argv.sysrpcuser;
const sysrpcpw = argv.sysrpcpw;

/* Initialize Geth Web3 */
let web3 = new Web3("ws://127.0.0.1:" + argv.ethwsport);
var collection = [];

/* Geth subscriber for new block headers */
const subscription_header = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
    if (error) return console.error(error);
    let obj = [blockHeader['number'],blockHeader['transactionsRoot']];
    collection.push(obj);
});

/* Timer for submitting header lists to Syscoin via RPC */
const timer = setInterval(pushToRPC, 50000);
function pushToRPC() {
	// Check if there's anything in the collection
	if (collection.length == 0) {
			console.log("collection is empty");
			return;
	}
	
	// Request options
	let options = {
        url: "http://localhost:" + sysrpcport,
        method: "post",
        headers:
        {
            "content-type": "text/plain"
        },
        auth: {
            user: sysrpcuser,
            pass: sysrpcpw 
        },
        body: JSON.stringify( {"jsonrpc": "1.0", "id": "ethheader_update", "method": "syscoinsetethheaders", "params": [collection]})
    };

    request(options, (error, response, body) => {
        if (error) {
            console.error('An error has occurred: ', error);
        } 
    });

	console.log("syscoinsetethheaders: ", JSON.stringify(collection));
	collection = [];
};

// unsubscribes the header subscription
subscription_header.unsubscribe((error, success) => {
    if (error) return console.error(error);

    console.log('Successfully unsubscribed!');
	clearInterval(timer);
});

/*  Subscription for Geth syncing status */
const subscription_sync = web3.eth.subscribe('syncing', function(error, sync){
    if (error) return console.error(error);

	var params = [];
	if (typeof(sync) == "boolean") {
		if (sync) {
			params = ["syncing", 0];
	    } else  {
	     	params = ["synced", 0];
		}
	} else {
		params = ["syncing", sync.status.HighestBlock];
	}

	let options = {
        url: "http://localhost:" + sysrpcport,
        method: "post",
        headers:
        {
            "content-type": "text/plain"
        },
        auth: {
            user: sysrpcuser,
            pass: sysrpcpw 
        },
        body: JSON.stringify( {
				"jsonrpc": "1.0", 
				"id": "sync_update", 
				"method": "syscoinsetethstatus",
				"params": params})
    };
    console.log(options.body);

    request(options, (error, response, body) => {
        if (error) {
            console.error('An error has occurred: ', error);
        } else {
            console.log('Post successful: response: ', body);
        }
    });
	console.log("syscoinsetethstatus: ", params);
});

// unsubscribes the subscription
subscription_sync.unsubscribe(function(error, success){
    if(success)
        console.log('Successfully unsubscribed!');
});
