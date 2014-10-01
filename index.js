global.config = require("./config");

var steam = require("steam"),
    path = require("path"),
    util = require("util"),
    fs = require("fs"),
    dota2 = require("dota2"),
    bot = new steam.SteamClient(),
    Dota2 = new dota2.Dota2Client(bot, true),
	BotClient = require("./bot_client.js").BotClient,
	SteamTrade = require('steam-trade'),
	steamTrade = new SteamTrade(),
    TriviaPlugin = require("./trivia.js").TriviaPlugin,
    plugins = [TriviaPlugin]
    
/* Steam logic */
var onSteamLogOn = function onSteamLogOn(){
	bot.setPersonaState(steam.EPersonaState.Busy); // to display your bot's status as "Online"
	bot.setPersonaName(config.steam_name); // to change its nickname
	util.log("Steam logged on.");
	Dota2.launch();
	Dota2.on("ready", function() {
		util.log("Node-dota2 ready.");
		Dota2.joinChat(config.channel);
		Dota2.joinChat(config.ownerChannel);
		setTimeout(function(){
			botClient.start();
            botClient.sendMessage(config.channel, util.format(config.messages.welcome, config.steam_name));
		}, 3000);
	});

	Dota2.on("unready", function onUnready(){
		util.log("Node-dota2 unready.");
		botClient.stop();
	});

	Dota2.on("chatMessage", function(channel, personaName, message, chatObject) {
		if (channel === config.ownerChannel && chatObject.accountId === config.ownerId) {
			var cmds = message.match(/('[^']+'|[^ ]+)/g);
			botClient.onChatMessage(channel, personaName, message, chatObject);
		}
		else {
			botClient.onChatMessage(channel, personaName, message, chatObject);
		}
	});
	Dota2.on("clientOutdated", function(kMsg) {
        util.log("CLIENT OUTDATED " + kMsg);
	});
	Dota2.on("unhandled", function(kMsg) {
		util.log("UNHANDLED MESSAGE " + kMsg);
	});
},
onSteamSentry = function onSteamSentry(sentry) {
	util.log("Steam received sentry.");
	fs.writeFile(path.resolve(__dirname,'sentry'), sentry);
},
onSteamServers = function onSteamServers(servers) {
	util.log("Steam received servers.");
	fs.writeFile(path.resolve(__dirname,'servers'), JSON.stringify(servers));
},
onWebSessionID = function onWebSessionID(webSessionID) {
	util.log("Steam received web session id.");
	steamTrade.sessionID = webSessionID;
	bot.webLogOn(function onWebLogonSetTradeCookies(cookies) {
		util.log("Steam received cookies.");
		for (var i = 0; i < cookies.length; i++) {
			util.log(cookies);
			steamTrade.setCookie(cookies[i]);
		}
	});
},
onSteamLogOff = function() {
	util.log("Steam logged off.");
	botClient.stop();
    Dota2.removeAllListeners('ready');
    Dota2.removeAllListeners('unready');
    Dota2.removeAllListeners('chatMessage');
    Dota2.removeAllListeners('unhandled');
    bot.logOn(logOnDetails);
},
onSteamFriend = function(steamId, EFriendRelationship) {
	util.log('onSteamFriend',steamId, EFriendRelationship);
	if (EFriendRelationship == steam.EFriendRelationship['RequestRecipient']) {
		console.log('accepting friend request', steamId);
		bot.addFriend(steamId);
	}
},
onSteamRelationships = function() {
	for (f in bot.friends) {
		if (bot.friends[f] == steam.EFriendRelationship['RequestRecipient']) {
			util.log(util.format('Steam accepting friend request %s', f));
			bot.addFriend(f);
		}
	}
},
onSteamFriendMessage = function(steamId, msg, EChatEntryType) {
    util.log(util.format('Steam onSteamFriendMessage %s, %s, %s', steamId, msg, EChatEntryType));
	if (EChatEntryType == steam.EChatEntryType['ChatMsg']){
		if (steamId != config.ownerId) {
			bot.sendMessage(steamId, config.steamChatAutoReply);
		}
	}
},
onSteamTradeProposed = function(tradeId, steamId) {
    util.log(util.format('Steam onSteamTradeProposed %s, %s', tradeId, steamId));
	bot.respondToTrade(tradeId,true);
},
onSteamSessionStart = function(steamId) {
    util.log(util.format('Steam onSteamSessionStart %s', steamId));
	steamTrade.open(steamId);
},
onSteamTradeReady = function() {
	steamTrade.ready(function() {
        util.log('Steam trade ready');
		steamTrade.confirm(function() {
            util.log(util.format('Steam trade confirmed %s', steamTrade.tradePartnerSteamID));
		});
	});
},
onSteamTradeEnd = function(status, getItems) {
    util.log(util.format('Steam onSteamTradeEnd %s', status));
	if (status == 'complete') {
		bot.sendMessage(steamTrade.tradePartnerSteamID, "Thanks for the donation!");
		getItems(function(items) {
			util.log(util.format('Steam items %s', items));
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

// Create bot
botClient = new BotClient(Dota2, config, plugins);
bot.logOn(logOnDetails);

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
