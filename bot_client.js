var http = require('http');
var fs = require("fs");
var util = require("util");
var trivia = require('./trivia.js');
var spawn = require('child_process').spawn;
var nodemailer = require("nodemailer");
var Client = require('ftp');

var BotClient = function BotClient(dotaClient, config, db, debug){
	var self = this;
	self.dotaClient = dotaClient;
	self.config = config;
	self.debug = false || debug;
	self.db = db;
	self.triviaClient = new trivia.Trivia(this, config, db, debug);
	self.started = false;
	self.queuedMessages = [];
	self.queuedMessageLoop = setInterval(function() {
		if (self.queuedMessages.length > 0) {
			self.dotaClient.sendMessage(self.queuedMessages[0][0],self.queuedMessages[0][1]);
			self.queuedMessages = self.queuedMessages.slice(1);
		}
	},1000);
	// Load trivia file data
	fs.readFile(config.questionListPath, 'utf8', function(err, data) {
		if (err) throw err;
		self.triviaClient.questionData = data.trim('\n').split('\n').shuffle();
	});
	fs.readFile(config.wordListPath, 'utf8', function(err, data) {
		if (err) throw err;
		self.triviaClient.wordListData = data.trim('\n').split('\n').shuffle();
	});
	fs.readFile(config.sortListPath, 'utf8', function(err, data) {
		if (err) throw err;
		self.triviaClient.sortListData = data.trim('\n').split('\n').shuffle();
	});
	
	// Load ignore list
	fs.readFile(config.ignoreListPath, 'utf8', function(err, data) {
		if (err) throw err;
		self.ignoreList = data.trim('\n').split('\n');
	});
	
	self.userCmdQueue = [];
	self.lastCmdSendTime = {};
	
	// Process user command loop
	self.processUserCmds = setInterval(function() {
		if (self.userCmdQueue.length > 0) {
			var userCmd = self.userCmdQueue.shift();
			switch (userCmd[0]) {
				case 'about':
				case 'help':
				case 'info':
					self.sendHelpMessage();
				break;
				case 'report':
				case 'alert':
					self.sendReportMessage(userCmd[0], userCmd[1], userCmd[2], userCmd[3], userCmd[4]);
				break;
				case 'id':
					self.getUserIdCommand(userCmd[0], userCmd[1], userCmd[2], userCmd[3], userCmd[4]);
				break;
				default:
					self.triviaClient.handleCommand(userCmd[0], userCmd[1], userCmd[2], userCmd[3]);
				break;
			}
		}
	},self.config.processUserCmdsWait);
};

BotClient.prototype.onChatMessage = function(channel, personaName, message, chatObject) {
	var self = this;
	util.log(chatObject.accountId + ' ' + personaName + ': ' + message);
	// send command messages to handler and the rest to trivia client to check if it's an answer
	if (self.ignoreList.indexOf(chatObject.accountId.toString()) == -1) {
		if (message.charAt(0) == self.config.cmdChar && message.length > 1) {
			var args = message.substring(1).match(/('[^']+'|[^ ]+)/g);
			self.handleCommand(args[0],args.slice(1),chatObject.accountId, personaName, chatObject);
		}
		else {
			self.triviaClient.onChatMessage(channel, personaName, message, chatObject);
		}
	}
	else {

	}
};

BotClient.prototype.handleCommand = function(cmd, args, userId, personaName, chatObject) {
	var self = this;
	console.log('handling command', cmd);
	if (userId == self.config.ownerId) {
		switch (cmd) {
			case 'update':
				self.updateFiles(cmd,args,userId,personaName,chatObject);
			break;
			
			case 'join':
				self.dotaClient.joinChat(args.join(' ').replace(/'/g, ''));
			break;
			
			case 'leave':
				self.dotaClient.leaveChat(args.join(' ').replace(/'/g, ''));
			break;
			
			case 'say':
				self.sendMessage(args[0].replace(/'/g, ''), args.slice(1).join(' ').replace(/'/g, ''));
			break;
			
			case 'announce':
			
			break;
			
			case 'about':
			case 'help':
			case 'info':
				self.sendHelpMessage();
			break;
			
			case 'report':
			case 'alert':
				self.sendReportMessage(cmd,args,userId,personaName,chatObject);
			break;
			
			case 'id':
				self.getUserIdCommand(cmd,args,userId,personaName,chatObject);
			break;
			
			case 'ignore':
				self.addIgnoreUser(cmd,args,userId,personaName,chatObject);
			break;
			
			case 'trivia':
			case 'score':
			case 'points':
			case 'rank':
			case 'top':
			case 'stats':
			case 'question':
			case 'cancel':
				self.triviaClient.handleCommand(cmd,args,userId,personaName);
			break;
			
			case 'backup':
				self.handleDatabaseBackup();
			break;
		}
	}
	else {
		var now = new Date();
		if (self.lastCmdSendTime[userId] == undefined || now - self.lastCmdSendTime[userId] > self.config.lastCmdSendTimeWait) {
			if (self.userCmdQueue.length < self.config.userCmdQueueMax) {
				switch (cmd) {
					case 'about':
					case 'help':
					case 'info':
					case 'report':
					case 'alert':
					case 'id':
/*					case 'score':
					case 'points':
					case 'rank':
*/
					case 'top':
					case 'stats':
						self.lastCmdSendTime[userId] = now;
						self.userCmdQueue.push([cmd, args, userId, personaName, chatObject]);
					break;
					case 'question':
					case 'cancel':
						self.triviaClient.handleCommand(cmd,args,userId,personaName);
					break;
				}
			}
		}
	}
};

BotClient.prototype.sendHelpMessage = function() {
	var self = this;
	self.sendMessage(self.config.channel, 'Available commands: !stats, !top scores, !top streaks, !question.\nTo send a message to the bot owner use: !report <msg>.\nYou are limited to one command every five minutes.');
}

BotClient.prototype.sendReportMessage = function(cmd, args, userId, personaName, chatObject) {
	var self = this;
	console.log('report command');
	self.sendEmailNotification('Trivia Bot Report Message', personaName + '(' + chatObject.accountId + '): ' + args.join(' '));
	self.dotaClient._client.sendMessage('76561198015512690', personaName + '(' + chatObject.accountId + '): ' + args.join(' '));
}

BotClient.prototype.getUserIdCommand = function(cmd, args, userId, personaName, chatObject) {
	var self = this;
	self.sendMessage(self.config.channel, personaName + '\'s account id is ' + chatObject.accountId);
}

BotClient.prototype.addIgnoreUser = function(cmd, args, userId, personaName, chatObject) {
	var self = this;
	fs.appendFile('./ignorelist', args[0].toString() + '\n', function (err) {
		if (err) {
			console.log(err);
		}
		else {
			self.ignoreList.push(args[0].toString());
			self.sendMessage(self.config.channel, 'User with account id ' + args[0] + ' has been ignored.');
		}
	});
}

BotClient.prototype.sendMessage = function(channel,msg) {
	var self = this;
	if (!self.debug && self.started) self.queuedMessages.push([channel,msg]);
	console.log('queued msg',channel,msg);
}

BotClient.prototype.updateFiles = function(cmd, args, userId, personaName, chatObject) {
	var self = this;
	console.log('update file command');
	self.downloadFile(args[0],args[1], function() {
		self.sendMessage(config.ownerChannel, 'File at ' + args[0] + ' downloaded to ' + args[1] + '.');
		console.log('File at ' + args[0] + ' downloaded to ' + args[1] + '.');	
	});

}

BotClient.prototype.downloadFile = function(url, dest, callback) {
  var file = fs.createWriteStream(dest);
  var request = http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close();
      callback();
    });
  });
}

BotClient.prototype.stop = function(callback) {
	var self = this;
	self.started = false;
	self.triviaClient.stop(function() {
		console.log('bot stopped');
		callback();
	});
}

BotClient.prototype.handleDatabaseBackup = function() {
	var self = this;
	self.triviaClient.stop(function() {
		self.doDatabaseBackup(function() {
			self.triviaClient.start();
		});
	});
}

BotClient.prototype.doDatabaseBackup = function(callback) {
	var self = this;
	console.log('starting database backup');
	var args = ['--db', self.config.databaseName, '--collection', 'users'],
		mongodump = spawn(self.config.mongodump, args);
	mongodump.stdout.on('data', function (data) {
		console.log('stdout: ' + data);
	});
	mongodump.stderr.on('data', function (data) {
		console.log('stderr: ' + data);
	});
	mongodump.on('exit', function (code) {
		console.log('mongodump exited with code ' + code);
		self.uploadToFTP();
		callback();
	});
}

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
	host: config.emailHost, // hostname
	secureConnection: false, // use SSL
	port: 587, // port for secure SMTP
    auth: {
        user: config.emailUser,
        pass: config.emailPass
    }
});

BotClient.prototype.sendEmailNotification = function(subject, text) {
	var self = this;
	if (self.config.emailNotifications) {
		var timeStamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
		// setup e-mail data with unicode symbols
		var mailOptions = {
			from: "Trivia Bot <" + self.config.emailUser + ">", // sender address
			to: self.config.emailRecipient, // list of receivers
			subject: subject, // Subject line
			text: timeStamp + ' ' + text, // plaintext body
			html: timeStamp + ' ' + text // html body
		}
		
		// send mail with defined transport object
		smtpTransport.sendMail(mailOptions, function(error, response){
			if(error){
				console.log(error);
			}else{
				console.log("Email sent: " + response.message);
			}

			// if you don't want to use this transport object anymore, uncomment following line
			//smtpTransport.close(); // shut down the connection pool, no more messages
		});
	}
};


BotClient.prototype.uploadToFTP = function(callback) {
	var c = new Client();
	
	var getFiles = function(dir) {
		var files = fs.readdirSync(dir);
		c.mkdir(dir, function(err) {
			console.log(err);
		});
		for(var i in files){
			if (!files.hasOwnProperty(i)) continue;
			var name = dir+'/'+files[i];
			if (fs.statSync(name).isDirectory()){
				getFiles(name);
			}else{
				c.put(name,name, function(err, stream) {
					console.log(err, stream);
				});
				console.log(name);
			}
		}
	}
	
	c.on('ready', function() {
		getFiles(config.dumpPath);
	});
	c.connect({host:config.ftpHost,user:config.ftpUser,password:config.ftpPass});


}

exports.BotClient = BotClient;
