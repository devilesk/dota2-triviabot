var http = require("http");
var path = require("path");
var fs = require("fs");
var util = require("util");
var BotClient = require("./bot_client").BotClient;
var Round = require("./trivia.round.js").Round;
var UserCollection = require("./trivia.user.js").UserCollection;

var TriviaPlugin = function TriviaPlugin(bot) {
    this.name = 'TriviaPlugin';
    this.bot = bot;
    this.dota = bot.dota;
    this.config = bot.config;
    this.ignoreList = bot.ignoreList;
    this.plugins = [];
    this.userCollection = new UserCollection(this.config);
    this.round = null;
    this.triviaStarted = false;
    this.onRoundEndRestart = false;
    this.onRoundEndStop = false;
    this.roundStartTimer = null;
    this.killTimer = null;
    this.lastQuestionRepeatTime = new Date();
};
util.inherits(TriviaPlugin, BotClient);

TriviaPlugin.prototype.start = function () {
    this.triviaStarted = true;
    var self = this;
    this.bot.messageQueue.push([this.config.channel, 'Trivia starting.']);
    this.round = new Round(this);
    this.round.start();
}

TriviaPlugin.prototype.restart = function () {
    this.onRoundEndRestart = false;
    this.triviaStarted = false;
    this.round.end();
    this.destroy();
    this.bot.messageQueue.push([this.config.channel, 'Trivia restarting.']);
    this.bot.restart(this);
}

TriviaPlugin.prototype.stop = function () {
    clearTimeout(this.roundStartTimer);
    this.onRoundEndStop = false;
    this.triviaStarted = false;
    this.round.end();
    this.bot.messageQueue.push([this.config.channel, 'Trivia stopped.']);
}

TriviaPlugin.prototype.destroy = function () {
    this.round.destroy();
    clearTimeout(this.roundStartTimer);
    clearTimeout(this.killTimer);
}

TriviaPlugin.prototype.onRoundEnd = function () {
    if (this.triviaStarted) {
        if (this.onRoundEndStop) {
            this.stop();
        }
        else if (this.onRoundEndRestart) {
            this.restart();
        }
        else if (this.round.unansweredCount < this.config.unansweredThreshold) {
            var self = this;
            this.roundStartTimer = setTimeout(function () {
                self.round.start();
            }, this.config.timeBetween);
        }
        else {
            this.bot.messageQueue.push([this.config.channel, this.config.restartPrompt, this.initKillTimer.bind(this)]);    
        }
    }

}

TriviaPlugin.prototype.initKillTimer = function () {
    var self = this;
    self.killTimer = setTimeout(function () {
        self.bot.kill();
    }, self.config.restartWait);
}

TriviaPlugin.prototype.commands = [
    { handler: 'trivia', aliases: ['trivia'] },
    { handler: 'top', aliases: ['top'] },
    { handler: 'stats', aliases: ['stats', 'score', 'points'] },
    { handler: 'question', aliases: ['question', 'repeat'] },
    { handler: 'cancel', aliases: ['cancel'] }
];
TriviaPlugin.prototype.userCommands = ['top', 'stats', 'question', 'cancel'];

TriviaPlugin.prototype.processMessage = function (channel, personaName, message, chatObject) {
    this.round.processMessage(channel, personaName, message, chatObject);
}

TriviaPlugin.prototype.handlers['trivia'] = function (args, accountId, personaName, chatObject) {
    switch (args[0]) {
        case 'restart':
            if (!this.triviaStarted) return;
            if (args[1] == '-now') {
                this.restart();
            }
            else {
                this.onRoundEndRestart = true;
            }
        break;
        case 'stop':
            if (!this.triviaStarted) return;
            if (args[1] == '-now') {
                this.stop();
            }
            else {
                this.onRoundEndStop = true;
            }
        break;
        case 'start':
            if (this.triviaStarted) return;
            this.start();
        break;
    }
}
TriviaPlugin.prototype.handlers['stats'] = function (args, accountId, personaName, chatObject) {
    var self = this;
    this.userCollection.get(chatObject.accountId, function (user) {
        self.userCollection.getRank(user.accountId, function (rank) {
            var message = util.format('%s: %s points, rank %s, best streak %s.', personaName, user.points, rank, user.bestStreak);
            self.bot.messageQueue.push([self.config.channel, message]);
        });
    });
}

TriviaPlugin.prototype.handlers['question'] = function (args, accountId, personaName, chatObject) {
    var now = new Date();
    if (this.round.inProgress && now - this.lastQuestionRepeatTime > this.config.repeatQuestionDelay) {
        this.lastQuestionRepeatTime = now;
        this.bot.messageQueue.unshift([this.config.channel, this.round.question]);
    }
}
TriviaPlugin.prototype.handlers['cancel'] = function (args, accountId, personaName, chatObject) {
    if (this.killTimer){
        clearTimeout(this.killTimer);
        this.bot.messageQueue.push([this.config.channel, 'Restart canceled. Resuming trivia.']);
        this.round.unansweredCount = 0;
        var self = this;
        setTimeout(function () {
            self.round.start();
        }, this.config.timeBetween);
    }
}
TriviaPlugin.prototype.handlers['top'] = function (args, accountId, personaName, chatObject) {
	var self = this;
    switch (args[0]) {
        case 'all':
        case 'alltime':
        case 'all-time':
        case 'overall':
        case 'total':
            self.userCollection.getTop(function (docs) {
                var message = '';
                for (var i=0;i<docs.length;i++) {
                    message += docs[i].personaName + ' - ' + docs[i].points + ', ';
                }
                message = 'Top 10 all-time: ' + message.substring(0,message.length-2) + '.'
                self.bot.messageQueue.push([self.config.channel, message]);
            }, 'all');
        break;
        case 'week':
        case 'weekly':
            self.userCollection.getTop(function (docs) {
                var message = '';
                for (var i=0;i<docs.length;i++) {
                    message += docs[i].personaName + ' - ' + docs[i].total + ', ';
                }
                message = 'Top 10 this week: ' + message.substring(0,message.length-2) + '.'
                self.bot.messageQueue.push([self.config.channel, message]);
            }, 'week');
        break;
        case 'day':
        case 'daily':
            self.userCollection.getTop(function (docs) {
                var message = '';
                for (var i=0;i<docs.length;i++) {
                    message += docs[i].personaName + ' - ' + docs[i].total + ', ';
                }
                message = 'Top 10 today: ' + message.substring(0,message.length-2) + '.'
                self.bot.messageQueue.push([self.config.channel, message]);
            }, 'day');
        break;
        case 'hour':
        case 'hourly':
        case 'recent':
        case 'now':
        default:
            self.userCollection.getTop(function (docs) {
                var message = '';
                for (var i=0;i<docs.length;i++) {
                    message += docs[i].personaName + ' - ' + docs[i].total + ', ';
                }
                message = 'Top 10 past hour: ' + message.substring(0,message.length-2) + '.'
                self.bot.messageQueue.push([self.config.channel, message]);
            }, 'hour');
        break;
    }

}

exports.TriviaPlugin = TriviaPlugin;
