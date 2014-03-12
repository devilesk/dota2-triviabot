global.config = require("./config_staging");

var steam = require("steam"),
    path = require("path"),
    util = require("util"),
    fs = require("fs"),
    dota2 = require("../"),
    bot = new steam.SteamClient(),
    Dota2 = new dota2.Dota2Client(bot, true),
	botClient = require("./bot_client.js"),
	BotClient,
	SteamTrade = require('steam-trade'),
	steamTrade = new SteamTrade(),
	MongoClient = require('mongodb').MongoClient,
	mongoDb;
	
// logging
/*var stdo = require('fs').createWriteStream(config.logsPath + '/log.txt');
var stderrlog = require('fs').createWriteStream(config.logsPath + '/error.txt');
process.stdout.write = (function(write) {
        return function(string, encoding, fd) {
                stdo.write(string);
        }
})(process.stdout.write)
process.stderr.write = (function(write) {
        return function(string, encoding, fd) {
                stderrlog.write(string);
        }
})(process.stderr.write)
*/
/* Steam logic */
var onSteamLogOn = function onSteamLogOn(){
	bot.setPersonaState(steam.EPersonaState.Busy); // to display your bot's status as "Online"
	bot.setPersonaName(config.steam_name); // to change its nickname
	util.log("Logged on.");
	BotClient.sendEmailNotification('Trivia Bot Logged Into Steam', 'Logged into Steam.');
	Dota2.launch();
	Dota2.on("ready", function() {
		console.log("Node-dota2 ready.");
		Dota2.joinChat(config.channel);
		Dota2.joinChat(config.ownerChannel);
		setTimeout(function(){
			Dota2.sendMessage(config.channel, config.steam_name + " has entered the channel.\nStats page and forum at dotatrivia.com.");
			BotClient.started = true;
			BotClient.triviaClient.start();
		}, 3000);
	});

	Dota2.on("unready", function onUnready(){
		console.log("Node-dota2 unready.");
		BotClient.stop(function() {
			console.log('exiting');
			//process.exit(0);
		});
	});

	Dota2.on("chatMessage", function(channel, personaName, message, chatObject) {
		if (channel == config.ownerChannel && chatObject.accountId == config.ownerId) {
			var cmds = message.match(/('[^']+'|[^ ]+)/g);
			console.log(cmds);
			BotClient.onChatMessage(channel, personaName, message, chatObject);
		}
		else {
			BotClient.onChatMessage(channel, personaName, message, chatObject);
		}
	});
	Dota2.on("clientOutdated", function(kMsg) {
	
	});
	Dota2.on("unhandled", function(kMsg) {
		util.log("UNHANDLED MESSAGE " + kMsg);
	});
},
onSteamSentry = function onSteamSentry(sentry) {
	util.log("Received sentry.");
	fs.writeFile(path.resolve(__dirname,'sentry'), sentry);
},
onSteamServers = function onSteamServers(servers) {
	util.log("Received servers.");
	fs.writeFile(path.resolve(__dirname,'servers'), JSON.stringify(servers));
},
onWebSessionID = function onWebSessionID(webSessionID) {
	util.log("Received web session id.");
	steamTrade.sessionID = webSessionID;
	bot.webLogOn(function onWebLogonSetTradeCookies(cookies) {
		util.log("Received cookies.");
		for (var i = 0; i < cookies.length; i++) {
			console.log(cookies);
			steamTrade.setCookie(cookies[i]);
		}
	});
},
onSteamLogOff = function() {
	util.log("Logged off.");
	BotClient.sendEmailNotification('Trivia Bot Logged Off Steam', 'Logged off Steam.');
	BotClient.stop(function() {
		console.log('exiting');
		Dota2.removeAllListeners('ready');
		Dota2.removeAllListeners('unready');
		Dota2.removeAllListeners('chatMessage');
		Dota2.removeAllListeners('unhandled');
		bot.logOn(logOnDetails);
	});
},
onSteamFriend = function(steamId, EFriendRelationship) {
	console.log('onSteamFriend',steamId, EFriendRelationship);
	if (EFriendRelationship == steam.EFriendRelationship['RequestRecipient']) {
		console.log('accepting friend request', steamId);
		bot.addFriend(steamId);
	}
},
onSteamRelationships = function() {
	console.log('friends and groups has data');
	console.log(bot.friends);
	for (f in bot.friends) {
		if (bot.friends[f] == steam.EFriendRelationship['RequestRecipient']) {
			console.log('accepting friend request', f);
			bot.addFriend(f);
		}
	}
},
onSteamFriendMessage = function(steamId, msg, EChatEntryType) {
	console.log('onSteamFriendMessage',steamId, msg, EChatEntryType);
	if (EChatEntryType == steam.EChatEntryType['ChatMsg']){
		bot.sendMessage(steamId, "Hello, I'm a bot. Right now, I'm only capable of accepting item donations via trade and running trivia in-game. If you have an important message to send the owner, send him a friend request: http://steamcommunity.com/id/devilesk/");
	}
},
onSteamTradeProposed = function(tradeId, steamId) {
	console.log('onSteamTradeProposed',tradeId, steamId);
	bot.respondToTrade(tradeId,true);
},
onSteamSessionStart = function(steamId) {
	console.log('onSteamSessionStart', steamId);
	steamTrade.open(steamId);
},
onSteamTradeReady = function() {
	steamTrade.ready(function() {
		steamTrade.confirm(function() {
			console.log(steamTrade.tradePartnerSteamID);
			console.log('steam trade confirmed');
		});
	});
},
onSteamTradeEnd = function(status, getItems) {
	console.log('onSteamTradeEnd', status);
	if (status == 'complete') {
		BotClient.sendEmailNotification('Trivia Bot Completed Trade', 'Completed trade with ' + steamTrade.tradePartnerSteamID + '.');
		bot.sendMessage(steamTrade.tradePartnerSteamID, "Thanks for the donation!");
		getItems(function(items) {
			console.log(items);
		});
	}
};
	
// Login credentials, only passing authCode if it exists
var logOnDetails = {
    "accountName": config.steam_user,
    "password": config.steam_pass,
};
if (config.steam_guard_code) logOnDetails.authCode = config.steam_guard_code;
var sentry = fs.readFileSync(path.resolve(__dirname,'sentry'));
if (sentry.length) logOnDetails.shaSentryfile = sentry;

// Connect to the db and login
MongoClient.connect(config.databaseAddress + config.databaseName, function(err, db) {
	if(!err) {
		console.log("We are connected to " + config.databaseAddress + config.databaseName);
		mongoDb = db;
	}
	else {
		console.log("Not connected to " + config.databaseAddress + config.databaseName);
	}
	BotClient = new botClient.BotClient(Dota2, config, mongoDb);
	bot.logOn(logOnDetails);
	
	// backup timer
	var backupPerformed = false;
	var lastBackupDate;
	setInterval(function() {
		var now = new Date();
		if (now.getHours() - config.backupTime[0] == 0 && now.getMinutes() - config.backupTime[1] == 0 && Math.abs(now.getSeconds() - config.backupTime[2]) < 5) {
			if (backupPerformed == false) {
				backupPerformed = true;
				console.log('setting triviaClient doDatabaseBackup flag');
				BotClient.triviaClient.doDatabaseBackup = true;
			}
		}
		else {
			backupPerformed = false;
		}
	},1000);

});

// Event Listeners
bot.on("loggedOn", onSteamLogOn)
    .on('sentry', onSteamSentry)
    .on('servers', onSteamServers)
    .on('webSessionID', onWebSessionID)
	.on('loggedOff', onSteamLogOff)
	.on('friend', onSteamFriend)
	.on('relationships', onSteamRelationships)
	.on('friendMsg', onSteamFriendMessage)
	.on('tradeProposed', onSteamTradeProposed)
	.on('sessionStart', onSteamSessionStart);
	
steamTrade.on('ready', onSteamTradeReady)
	.on('end', onSteamTradeEnd);

// command line input
/*process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (chunk) {
	process.stdout.write('data: ' + chunk);
	BotClient.onChatMessage('channel', config.ownerChannel, chunk.trim('\n'), {accountId:config.ownerId,personaName:'devilesk'});
});
*/

//Test Steam Reconnect
/*setTimeout(function() {
	bot.emit('loggedOff');
	setTimeout(function() {
		bot.logOn(logOnDetails);
	},10000);
},40000);
*/
/*setTimeout(function() {
	bot.logOff();
	onSteamLogOff();
	setTimeout(function() {
		onSteamLogOn()
	},20000);
},40000);
*/
