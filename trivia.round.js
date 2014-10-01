var fs = require("fs");
var path = require("path");
var util = require("util");
var loadFile = require("./common.js").loadFile;
var QuestionProducer = require("./trivia.question.js").QuestionProducer;
var Hint = require("./trivia.question.js").Hint;
var EventEmitter = require('events').EventEmitter;

var Round = function Round(triviaPlugin) {
    this.triviaPlugin = triviaPlugin;
    this.questionProducer = new QuestionProducer(triviaPlugin.config);
    this.question = null;
    this.answer = null;
    this.unansweredCount = 0;
    this.hint = null;
	this.startTime = null;
    this.guesses = {};
    this.streak = {
        accountId: null,
        personaName: null,
        count: 0
    }
    this.count = 0;
    this.answered = false;
    this.inProgress = false;
}

Round.prototype.elapsedTime = function () {
    return new Date() - this.startTime;
}

Round.prototype.start = function () {
    var self = this;
    this.questionProducer.getQuestion(function (data) {
        self.inProgress = true;
        self.question = data[0];
        self.answer = data[1];
        self.guesses = {};
        self.hint = new Hint(self.answer, self.triviaPlugin.config.maxHints);
        self.startTime = new Date();
        self.triviaPlugin.bot.messageQueue.push([self.triviaPlugin.config.channel, self.question]);
        self.answered = false;
        clearInterval(self.timer);
        self.timer = setInterval(function () {
            if (!this.answered) {
                var prevCount = self.count;
                var isUnansweredCheck = function () {
                    //console.log('isUnansweredCheck', !self.answered && prevCount == self.count, !self.answered, prevCount, self.count);
                    return !self.answered && prevCount == self.count;
                }
                if (self.hint.count <= self.hint.maxHints) {
                    self.triviaPlugin.bot.messageQueue.push([self.triviaPlugin.config.channel, self.hint.get(), null, isUnansweredCheck]);
                }
                else {
                    clearInterval(self.timer);
                    var streakMessage = self.getEndStreakMessage();
                    var reply = util.format("Time's up! The answer is %s.%s", self.answer, streakMessage);
                    //self.triviaPlugin.bot.messageQueue.push([self.triviaPlugin.config.channel, 'Time almost up...']);
                    self.triviaPlugin.bot.messageQueue.push([self.triviaPlugin.config.channel, reply, self.unansweredEnd.bind(self), isUnansweredCheck]);
                }
            }
        }, self.triviaPlugin.config.hintInterval);
    }, function (reason) {
        util.log(reason);
    });
}

Round.prototype.isUnanswered = function() {
    return !this.answered;
}

Round.prototype.unansweredEnd = function () {
    if (this.inProgress) {
        this.unansweredCount++;
        this.streak = {
            accountId: null,
            personaName: null,
            count: 0
        }
        this.end();
    }
}
    
Round.prototype.end = function () {
    this.inProgress = false;
    this.endTime = new Date();
    this.question = null;
    this.answer = null;
    this.hint = null;
    this.guesses = null;
    this.count++;
    clearInterval(this.timer);
    this.triviaPlugin.onRoundEnd();
}

Round.prototype.destroy = function () {
    this.questionProducer.destroy();
    clearInterval(this.timer);
}
    
Round.prototype.processMessage = function (channel, personaName, message, chatObject) {
    if (this.inProgress && !this.answered) {
        //console.log('In-game in', channel, ':', personaName, message);
        if (message.toLowerCase().trim() === this.answer.toLowerCase().trim()) {
            this.answered = true;
            clearInterval(this.timer);
            var self = this;
            this.triviaPlugin.userCollection.get(chatObject.accountId, function (user) {
                var pointReward = self.getPointsForAnswer(chatObject.accountId);
                self.triviaPlugin.userCollection.giveUserPoints(chatObject.accountId, chatObject.personaName, pointReward);
                var streakMessage = self.getStreakMessage(chatObject);
                var reply = util.format('%s is correct! The answer is %s.%s (+%s points, %s total) [%s ms]', personaName, self.answer, streakMessage, pointReward, user.points + pointReward, self.elapsedTime());
                self.triviaPlugin.bot.messageQueue.push([self.triviaPlugin.config.channel, reply]);
                self.unansweredCount = 0;
                self.end();
            }, personaName);
        }
        else {
            if (this.guesses[chatObject.accountId] === undefined) {
                this.guesses[chatObject.accountId] = 1;
            }
            else {
                this.guesses[chatObject.accountId] += 1;
            }
        }
    }
}

Round.prototype.getStreakMessage = function (chatObject) {
	var msg = ''
	if (this.streak.accountId === null) {
		this.streak.count = 1;
	}
	else if (this.streak.accountId === chatObject.accountId) {
		this.streak.count++;
		if (this.streak.count > 1) {
			msg = util.format(' %s has answered %s in a row!', chatObject.personaName, this.streak.count);
		}
	}
	else if (this.streak.accountId !== chatObject.accountId) {
		if (this.streak.count > 1) {
            msg = util.format(" %s has ended %s's streak of %s!", chatObject.personaName, this.streak.personaName, this.streak.count);
		}
		this.streak.count = 1;
	}
	this.streak.accountId = chatObject.accountId;
	this.streak.personaName = chatObject.personaName;
    this.triviaPlugin.userCollection.updateUserStreak(this.streak.accountId, this.streak.count);
	return msg;
};

Round.prototype.getEndStreakMessage = function () {
	var msg = '';
	if (this.streak.accountId !== null) {
		if (this.streak.count > 1) {
            msg = util.format(" %s's answer streak of %s has ended!", this.streak.personaName, this.streak.count);
		}
	}
	return msg;
}

Round.prototype.getPointsForAnswer = function(accountId) {
    return (this.guesses[accountId] === undefined) ? 5 : (5 - Math.min(this.guesses[accountId], 4))
};

exports.Round = Round;