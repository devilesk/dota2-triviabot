// TODO: mongo capped collection for logging.

var http = require("http");
var path = require("path");
var fs = require("fs");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var loadFile = require("./common.js").loadFile;
var tokenize = require("./common.js").tokenize;

var BotClient = function BotClient(dota, config, pluginList){
    var self = this;
    this.dota = dota;
    this.config = config;
    this.plugins = [];
    this.messageQueue = [];
    this.commandQueue = [];
    this.ignoreList = [];
    
    pluginList.map(function (plugin) {
        this.plugins.push(new plugin(self));
    }, this);
    
    loadFile(this.config.ignoreListPath, function (data) {
        if (data) self.ignoreList = data.trim('\n').split('\n');
    });
};

BotClient.prototype.lastCmdSendTime = {};

BotClient.prototype.start = function () {
    var self = this;
    
    this.messageQueueProcessInterval = setInterval(this.messageQueueProcess.bind(this), this.config.sendMessageDelay);
    
    this.commandQueueProcess = setInterval(function () {
        if (self.commandQueue.length > 0) {
            var data = self.commandQueue.shift();
            self.processCommand(data[0], data[1], data[2], data[3], data[4]);
        }
    }, this.config.processUserCmdsWait);
    
    this.plugins.map(function (plugin) {
        plugin.start();
    });
}

BotClient.prototype.messageQueueProcess = function () {
    if (this.messageQueue.length > 0) {
        var data = this.messageQueue.shift();
        if (data[3]) {
            if (data[3]()) {
                this.sendMessage(data[0], data[1]);
            }
            else {
                this.messageQueueProcess();
                return;
            }
        }
        else {
            this.sendMessage(data[0], data[1]);
        }
        if (data[2]) data[2]();
    }
}

BotClient.prototype.kill = function () {
    clearInterval(this.messageQueueProcessInterval);
    clearInterval(this.commandQueueProcess);
    for (var i = 0; i < this.plugins.length; i++) {
        this.plugins[i].destroy();
    }
    this.dota.exit();
    var self = this;
    setTimeout(function () {
        self.dota._client.logOff();
        setTimeout(function () {
            process.exit(0);
        }, 1000);
    }, 1000);
}

BotClient.prototype.stop = function () {
    clearInterval(this.messageQueueProcessInterval);
    clearInterval(this.commandQueueProcess);
    this.plugins.map(function (plugin) {
        plugin.stop();
    });
    this.messageQueue.length = 0;
}

BotClient.prototype.restart = function (plugin) {
    if (plugin) {
        for (var i = 0; i < this.plugins.length; i++) {
            if (this.plugins[i] == plugin) {
                this.plugins[i] == new plugin.constructor(this);
                this.plugins[i].start();
                return;
            }
        }
    }
    else {
        this.kill();
    }
}

BotClient.prototype.onChatMessage = function (channel, personaName, message, chatObject) {
	if (this.ignoreList.indexOf(chatObject.accountId.toString()) === -1) {
		if (message.charAt(0) === this.config.cmdChar && message.length > 1) {
            var args = tokenize(message.substring(1));
            if (chatObject.accountId == this.config.ownerId) {
                this.processCommand(args[0], args.slice(1), chatObject.accountId, personaName, chatObject);
            }
            else {
                var now = new Date();
                if (this.lastCmdSendTime[chatObject.accountId] === undefined || now - this.lastCmdSendTime[chatObject.accountId] > this.config.lastCmdSendTimeWait) {
                    if (this.commandQueue.length < this.config.userCmdQueueMax) {
                        this.commandQueue.push([
                            args[0],
                            args.slice(1),
                            chatObject.accountId,
                            personaName,
                            chatObject
                        ]);
                        this.lastCmdSendTime[chatObject.accountId] = now;                    
                    }
                }
            }
		}
		else {
            this.plugins.map(function (plugin) {
                plugin.onChatMessage(channel, personaName, message, chatObject);
            });
            this.processMessage(channel, personaName, message, chatObject);
		}
	}
}

BotClient.prototype.sendMessage = function (channel, msg) {
    this.dota.sendMessage(channel, msg);
}

BotClient.prototype.processMessage = function (channel, personaName, message, chatObject) {}

BotClient.prototype.processCommand = function (cmd, args, accountId, personaName, chatObject) {
    var handler = this.getHandler(cmd);
    if (handler) {
        if (this.hasHandlerPermission(handler, accountId)) {
            this.handlers[handler].call(this, args, accountId, personaName, chatObject);
        }
    }
    else {
        this.plugins.map(function (plugin) {
            plugin.processCommand(cmd, args, accountId, personaName, chatObject);
        });
    }
}

BotClient.prototype.commands = [
    { handler: 'stop', aliases: ['stop'] },
    { handler: 'restart', aliases: ['restart'] },
    { handler: 'say', aliases: ['say'] },
    { handler: 'report', aliases: ['report', 'alert'] },
    { handler: 'ignore', aliases: ['ignore', 'ban'] },
    { handler: 'unignore', aliases: ['unignore', 'unban'] },
    { handler: 'join', aliases: ['join'] },
    { handler: 'leave', aliases: ['leave'] }
];
BotClient.prototype.userCommands = ['report'];
BotClient.prototype.getHandler = function (cmd) {
    for (var i = 0; i < this.commands.length; i++) {
        if (this.commands[i].aliases.indexOf(cmd) !== -1) {
            return this.commands[i].handler;
        }
    }
    return null;
}

BotClient.prototype.hasHandlerPermission = function (handler, accountId) {
    return (accountId === this.config.ownerId) || (this.userCommands.indexOf(handler) !== -1);
}

BotClient.prototype.handlers = {};
BotClient.prototype.handlers['stop'] = function (args, accountId, personaName, chatObject) {
    this.stop();
}
BotClient.prototype.handlers['restart'] = function (args, accountId, personaName, chatObject) {
    this.restart();
}
BotClient.prototype.handlers['say'] = function (args, accountId, personaName, chatObject) {
    this.dota.sendMessage(args[0], args.slice(1).join(' '));
}
BotClient.prototype.handlers['join'] = function (args, accountId, personaName, chatObject) {
    this.dota.joinChat(args.join(' ').replace(/'/g, ''));
}
BotClient.prototype.handlers['leave'] = function (args, accountId, personaName, chatObject) {
    this.dota.leaveChat(args.join(' ').replace(/'/g, ''));
}
BotClient.prototype.handlers['report'] = function (args, accountId, personaName, chatObject) {
	this.dota._client.sendMessage(this.config.ownerId64, personaName + '(' + chatObject.accountId + '): ' + args.join(' '));
}
BotClient.prototype.handlers['ignore'] = function (args, accountId, personaName, chatObject) {
    if (this.ignoreList.indexOf(args[0]) === -1 && args[0] !== this.config.ownerId.toString()) {
        this.ignoreList.push(args[0]);
    }
    this.writeIgnoreListToFile();
}
BotClient.prototype.handlers['unignore'] = function (args, accountId, personaName, chatObject) {
    for (var i = this.ignoreList.length - 1; i >= 0; i--) {
        if (this.ignoreList[i] === args[0]) {
            this.ignoreList.splice(i, 1);
        }
    }
    this.writeIgnoreListToFile();
}

BotClient.prototype.writeIgnoreListToFile = function () {
    var data = this.ignoreList.join('\n');
    fs.writeFile(this.config.ignoreListPath, data, function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log("Ignore list saved.");
        }
    });
}

exports.BotClient = BotClient;