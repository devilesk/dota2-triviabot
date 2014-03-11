var fs = require("fs");

String.prototype.shuffle = function () {
    var a = this.split(""),
        n = a.length;

    for(var i = n - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a.join("");
}

String.prototype.replaceAt=function(index, character) {
      return this.substr(0, index) + character + this.substr(index+character.length);
}

Array.prototype.shuffle = function() {
    var counter = this.length, temp, index;
    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        index = Math.floor(Math.random() * counter);
        // Decrease counter by 1
        counter--;
        // And swap the last element with it
        temp = this[counter];
        this[counter] = this[index];
        this[index] = temp;
    }
    return this;
}

var Trivia = function Trivia(botClient, config, db, debug) {
	var self = this;
	self.debug = false || debug;
	self.botClient = botClient;
	self.questionData;
	self.wordListData;
	self.sortListData;
	self.question;
	self.answer;
	self.hint;
	self.hintInterval = config.hintInterval;
	self.maxHints;
	self.hintCount;
	self.hintTimer;
	self.timeBetween = config.timeBetween;
	self.timerBetween;
	self.inProgress = false;
	self.userData = {};
	self.started = false;
	self.startTime;
	self.endTime;
	self.lastRepeat;
	self.db = db;
	self.userCollection;
	self.db.createCollection("users", function(err, collection){
		if (err) console.log('collection error');
		self.userCollection = collection;
	});
	self.unansweredCount = 0;
	self.doDatabaseBackup = false;
};

Trivia.prototype.start = function() {
	var self = this;
	if (self.started) self.stop();
	console.log('trivia start');
	self.started = true;
	self.streak = { count:0 };
	self.unansweredCount = 0;
	self.askQuestion();
};

Trivia.prototype.stop = function(callback) {
	var self = this;
	console.log('trivia stop');
	clearInterval(self.hintTimer);
	clearTimeout(self.timerBetween);
	self.started = false;
	self.inProgress = false;
	
	if (callback != undefined) {
		callback();
	}
};

Trivia.prototype.askQuestion = function() {
	var self = this;
	if (!self.doDatabaseBackup) {
		if (self.unansweredCount < config.unansweredThreshold) {
			self.setQuestion(function(){
				self.sendMessage(config.channel, self.question);
				self.inProgress = true;
				self.startTime = new Date();
				self.lastRepeat = undefined;
				self.hintTimer = setInterval(function() {
					//console.log(self.hintCount, self.maxHints);
					if (self.hintCount <= self.maxHints) {
						self.showHint();
					}
					else {
						self.giveAnswer();
					}
					self.hintCount += 1;
				}, self.hintInterval);
			});
		}
		else {
			console.log('Bot restarting Dota 2 due to inactivity.');
			self.sendMessage(config.channel, "Bot suspects that its questions aren't being seen and will restart in 30 seconds. Say !cancel if you can see this message to prevent restart.");
			self.restartTimer = setTimeout(function() {
				self.sendMessage(config.channel, 'Restarting.');
				self.botClient.dotaClient.exit()
				console.log('Dota 2 exited');
				setTimeout(function() {
					console.log('process ending');
					process.exit(0);
					//self.botClient.dotaClient._client.logOff();
					//self.botClient.dotaClient.launch()
				}, 5000);
			}, config.restartWait);
		}
	}
	else {
		self.sendMessage(config.channel, 'Pausing trivia to do a routine database backup.');
		console.log('pausing trivia to start scheduled backup.');
		self.botClient.doDatabaseBackup(function() {
			self.doDatabaseBackup = false;
			self.sendMessage(config.channel, 'Backup finished. Trivia resumed.');
			console.log('scheduled backup finished. trivia resuming.');
			setTimeout(function() {
				self.askQuestion();
			},3000);
		});
	}
};

Trivia.prototype.setQuestion = function(callback) {
	var self = this;
	self.getQuestion(function(data) {
		//console.log(index,data,data[0],data[1]);
		self.question = data[0];
		self.answer = data[1];
		self.hintCount = 0;
		self.hintHiddenIndices = [];
		self.hint = new Array(self.answer.length + 1).join('*');
		for(var i=0; i<self.answer.length;i++) {
			if (self.answer[i] === ' ' || self.answer[i] === '.' || self.answer[i] === '-') {
				self.hint = self.hint.replaceAt(i,self.answer[i]);
			}
		}
		for(var i=0; i<self.hint.length;i++) {
			if (self.hint[i] === '*') {
				self.hintHiddenIndices.push(i);
			}
		}
		self.hintHiddenIndices = self.hintHiddenIndices.shuffle();
		self.hintHiddenIndicesLength = self.hintHiddenIndices.length;
		self.maxHints = Math.min(self.hintHiddenIndicesLength-1,config.maxHints);
		self.numChars = Math.floor((self.hintHiddenIndicesLength-1)/self.maxHints);
		self.userGuessCount = {};
		callback();	
	});

};

Trivia.prototype.getQuestion = function(callback) {
	var self = this;
	var type = Math.floor(Math.random()*5);
	switch (type) {
		case 0:
			if (self.wordListData.length == 0) {
				fs.readFile(config.wordListPath, 'utf8', function(err, data) {
					if (err) throw err;
					self.wordListData = data.trim('\n').split('\n').shuffle();
					console.log(self.wordListData.length);
					var data = self.wordListData.pop().split('*');
					data[0] = data[0] + ' ' + data[1].replace(/\s+/g, '').toLowerCase().shuffle();
					callback(data);
				});
			}
			else {
				var data = self.wordListData.pop().split('*');
				data[0] = data[0] + ' ' + data[1].replace(/\s+/g, '').toLowerCase().shuffle();
				callback(data);
			}
		break;
/*		case 1:
			if (self.sortListData.length == 0) {
				fs.readFile(config.sortListPath, 'utf8', function(err, data) {
					if (err) throw err;
					self.sortListData = data.trim('\n').split('\n').shuffle();
					console.log(self.sortListData.length);
					var data = self.sortListData.pop().split('*');
					self.createSortQuestion(data, callback);
				});
			}
			else {
				var data = self.sortListData.pop().split('*');
				self.createSortQuestion(data, callback);
			}

		break;*/
		default:
			if (self.questionData.length == 0) {
				fs.readFile(config.questionListPath, 'utf8', function(err, data) {
					if (err) throw err;
					self.questionData = data.trim('\n').split('\n').shuffle();
					console.log(self.questionData.length);
					var data = self.questionData.pop().split('*');
					callback(data);
				});
			}
			else {
				var data = self.questionData.pop().split('*');
				callback(data);
			}
		break;
	}	
}

Trivia.prototype.createSortQuestion = function(data, callback) {
	var self = this;
	var answer = [];
	for (var i=1;i<data.length;i++) {
		answer.push(i-1);
	}
	var answer = answer.shuffle();
	var final_answer = '';
	var question = 'Sort: Arrange the numbers 1 to ' + answer.length + ' ' + data[0];
	for (var i=0;i<answer.length;i++) {
		question += ' ' + (i+1) + '.' + data[answer[i]+1];
	}
	for (var i=0;i<answer.length;i++) {
		final_answer += (answer.indexOf(i)+1).toString();
	}
	callback([question, final_answer]);
}

Trivia.prototype.showHint = function() {
	var self = this;
	if (self.hintCount > 0) {
		for(var i=0; i<self.numChars;i++) {
			var c = self.hintHiddenIndices.pop();
			self.hint = self.hint.replaceAt(c,self.answer[c]);
		}
	}
	self.sendMessage(config.channel, 'Hint: ' + self.hint);
};

Trivia.prototype.giveAnswer = function() {
	var self = this;
	clearInterval(self.hintTimer);
	clearTimeout(self.timerBetween);
	self.sendMessage(config.channel, 'Time\'s up! The answer is ' + self.answer + '.' + self.getEndStreakMessage());
	self.inProgress = false;
	self.unansweredCount += 1;
	self.timerBetween = setTimeout(function() {
		self.askQuestion();
	},self.timeBetween);
};

Trivia.prototype.onChatMessage = function(channel, personaName, message, chatObject) {
	var self = this;
	//util.log(chatObject.accountId, personaName, message, self.answer);
	if (self.inProgress && message.toLowerCase() == self.answer.toLowerCase()) {
		clearInterval(self.hintTimer);
		clearTimeout(self.timerBetween);
		self.inProgress = false;
		self.unansweredCount = 0;
		self.endTime = new Date();
		self.elapsedTime = self.endTime - self.startTime;
		self.giveUserPoints(chatObject, function(pointReward) {
			self.sendMessage(config.channel, personaName + ' is correct! The answer is ' + self.answer + '.' + self.getStreakMessage(chatObject) + ' (+' + pointReward + ' points, ' + self.userData[chatObject.accountId].points + ' total) [' + self.elapsedTime + 'ms]');
		});
		self.timerBetween = setTimeout(function() {
			self.askQuestion();
		},self.timeBetween);
	}
	else if (self.inProgress) {
		if (self.userGuessCount[chatObject.accountId] == undefined) {
			self.userGuessCount[chatObject.accountId] = 1;
		}
		else {
			self.userGuessCount[chatObject.accountId] += 1;
		}
	}
};

Trivia.prototype.getStreakMessage = function(chatObject) {
	var self = this;
	var msg = ''
	if (self.streak.accountId == undefined) {
		self.streak.count = 1;
	}
	else if (self.streak.accountId == chatObject.accountId) {
		self.streak.count += 1;
		if (self.streak.count > 1) {
			msg = ' ' + chatObject.personaName + ' has answered ' + self.streak.count + ' in a row!';
		}
	}
	else if (self.streak.accountId != chatObject.accountId) {
		if (self.streak.count > 1) {
			msg = ' ' + chatObject.personaName + ' has ended ' + self.streak.personaName + '\'s streak of ' + self.streak.count + '!';
		}
		self.streak.count = 1;
	}
	self.streak.accountId = chatObject.accountId;
	self.streak.personaName = chatObject.personaName;
	self.updateUserStreak();
	return msg;
};

Trivia.prototype.updateUserStreak = function() {
	var self = this;
	if (self.userData[self.streak.accountId] == undefined) {
		console.log('update user streak failed. user not in userData');
	}
	else {
		if (self.userData[self.streak.accountId].bestStreak == undefined || self.userData[self.streak.accountId].bestStreak < self.streak.count) {
			self.userData[self.streak.accountId].bestStreak = self.streak.count;
			self.userCollection.update({accountId:self.streak.accountId}, {$set:{bestStreak:self.streak.count}}, {w:1}, function(err, result) {
				if (err) console.log('streak update error');
			});
		}
	}
};

Trivia.prototype.getEndStreakMessage = function() {
	var self = this;
	var msg = '';
	if (self.streak.accountId != undefined) {
		if (self.streak.count > 1) {
			msg = ' ' + self.streak.personaName + '\'s answer streak of ' + self.streak.count + ' has ended!';
		}
	}
	self.streak = { count:0 };
	return msg;
};

Trivia.prototype.giveUserPoints = function(chatObject, callback) {
	var self = this;
	var pointReward = self.getPointsForAnswer(chatObject.accountId);
	
	if (self.userData[chatObject.accountId] == undefined) {
		self.userCollection.findOne({accountId:chatObject.accountId}, function(err, item) {
			if (err) console.log('findOne error');
			if (item) {
				self.userData[chatObject.accountId] = item;
				self.userData[chatObject.accountId].points += pointReward;
				self.userCollection.update({accountId:chatObject.accountId}, {$inc:{points:pointReward}, $set:{personaName:chatObject.personaName}}, {w:1}, function(err, result) {
					if (err) console.log('update error');
				});
			}
			else {
				self.userData[chatObject.accountId] = { accountId:chatObject.accountId,points:pointReward,bestStreak:1,personaName:chatObject.personaName };
				self.userCollection.insert(self.userData[chatObject.accountId], {w:1}, function(err, result) {
					if (err) console.log('insert error');
				});
			}
			callback(pointReward);
		});
	}
	else {
		self.userCollection.update({accountId:chatObject.accountId}, {$inc:{points:pointReward}, $set:{personaName:chatObject.personaName}}, {w:1}, function(err, result) {
			if (err) console.log('update error');
		});
		self.userData[chatObject.accountId].points += pointReward;
		callback(pointReward);
	}
};

Trivia.prototype.getPointsForAnswer = function(userId) {
	var self = this;
	if (self.userGuessCount[userId] == undefined) {
		return 5;
	}
	else {
		return 5 - Math.min(self.userGuessCount[userId], 4);
	}
};

Trivia.prototype.getUser = function(userId, personaName, callback) {
	var self = this;
	if (self.userData[userId] == undefined) {
		self.userCollection.findOne({accountId:userId}, function(err, item) {
			if (err) console.log('findOne error');
			if (item) {
				self.userData[userId] = item;
			}
			else {
				self.userData[userId] = { accountId:userId,points:0,bestStreak:0,personaName:personaName };
				self.userCollection.insert(self.userData[userId], {w:1}, function(err, result) {
					if (err) console.log('insert error');
				});
			}
			callback(self.userData[userId]);
		});

	}
	else {
		callback(self.userData[userId]);
	}
}

Trivia.prototype.getUserRank = function(userId, personaName, callback) {
	var self = this;
	self.userCollection.findOne({accountId:userId}, function(err, item) {
		if (err) console.log('findOne error');
		if (item) {
			if (self.userData[userId] == undefined) {
				self.userData[userId] = item;
			}
			
			self.userCollection.find({ points: { $gt: item.points } }).count(function(err, count) {
				if (err) console.log('count error');
				callback(count+1);
			});
		}
		else {
			if (self.userData[userId] == undefined) {
				self.userData[userId] = { accountId:userId,points:0,bestStreak:0,personaName:personaName };
				self.userCollection.insert(self.userData[userId], {w:1}, function(err, result) {
					if (err) console.log('insert error');
				});
			}
			callback(-1);
		}
	});
};

Trivia.prototype.getUserScoreMessage = function(userId, personaName) {
	var self = this;
	self.getUser(userId, personaName, function(user) {
		self.sendMessage(config.channel, personaName + ' has ' + user.points + ' points.');
	});
};

Trivia.prototype.getUserStatsMessage = function(userId, personaName) {
	var self = this;
	self.getUser(userId, personaName, function(user) {
		self.getUserRank(userId, personaName, function(rank) {
			if (rank != -1) {
				self.sendMessage(config.channel, personaName + ': ' + user.points + ' points, rank ' + rank + ', best streak ' + user.bestStreak + '.');
			}
			else {
				self.sendMessage(config.channel, personaName + ': ' + user.points + ' points, unranked, best streak ' + user.bestStreak + '.');
			}
		});
	});
};

Trivia.prototype.getUserRankMessage = function(userId, personaName) {
	var self = this;
	self.getUserRank(userId, personaName, function(count) {
		if (count != -1) {
			self.sendMessage(config.channel, personaName + ', rank ' + count + '.');
		}
		else {
			self.sendMessage(config.channel, personaName + ', unranked.');
		}
	});

};

Trivia.prototype.getTopScores = function(userId, personaName) {
	var self = this;
	self.userCollection.find().sort({points:-1}).limit(10).toArray(function(err, docs){
		console.log("retrieved records:");
		console.log(docs);
		var message = '';
		for (var i=0;i<docs.length;i++) {
			message += docs[i].personaName + ' - ' + docs[i].points + ', ';
		}
		self.sendMessage(config.channel, 'Top 10 Points: ' + message.substring(0,message.length-2) + '.');
	});
}

Trivia.prototype.getTopStreaks = function(userId, personaName) {
	var self = this;
	self.userCollection.find().sort({bestStreak:-1}).limit(10).toArray(function(err, docs){
		console.log("retrieved records:");
		console.log(docs);
		var message = '';
		for (var i=0;i<docs.length;i++) {
			message += docs[i].personaName + ' - ' + docs[i].bestStreak + ', ';
		}
		self.sendMessage(config.channel, 'Top 10 Streaks: ' + message.substring(0,message.length-2) + '.');
	});
}

Trivia.prototype.sendMessage = function(channel,msg) {
	var self = this;
	self.botClient.sendMessage(channel,msg);
}

Trivia.prototype.repeatQuestion = function() {
	var self = this;
	self.now = new Date();
	if (self.inProgress == true) {
		if (self.lastRepeat == undefined) {
			self.lastRepeat = self.now;
			self.sendMessage(config.channel, self.question);
		}
		else if (self.now - self.lastRepeat > config.repeatQuestionDelay) {
			self.lastRepeat = self.now;
			self.sendMessage(config.channel, self.question);
		}
	}
}

Trivia.prototype.handleCommand = function(cmd, args, userId, personaName) {
	var self = this;
	console.log('trivia handling command', cmd);
	if (cmd == 'trivia') {
		if (userId == config.ownerId) {
			switch (args[0]) {
				case 'start':
					self.start();
				break;
				case 'stop':
					self.stop();
				break;
			}			
		}
	}
	else if (self.started) {
		switch (cmd) {
/*			case 'score':
			case 'points':
				self.getUserScoreMessage(userId, personaName);
			break;
			case 'rank':
				self.getUserRankMessage(userId, personaName);
			break;
*/
			case 'stats':
				self.getUserStatsMessage(userId, personaName);
			break;
			case 'top':
				switch (args[0]) {
					case 'points':
					case 'scores':
						self.getTopScores(userId, personaName);
					break;
					case 'streaks':
						console.log('top streaks command');
						self.getTopStreaks(userId, personaName);
					break;
				}	
			break;
			case 'question':
				self.repeatQuestion();
			break;
			case 'cancel':
				console.log('trivia cancel restart');
				if (self.unansweredCount >= config.unansweredThreshold) {
					clearTimeout(self.restartTimer);
					self.unansweredCount = 0;
					console.log('cancel restart');
					self.sendMessage(config.channel, "Restart canceled. Trivia resuming.");
					self.timerBetween = setTimeout(function() {
						self.askQuestion();
					},self.timeBetween);
				}
			break;

		}
	}
};

exports.Trivia = Trivia;