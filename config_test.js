var config = {};

config.steam_name = "<steam display name>";
config.steam_user = "<your steam account name>";
config.steam_pass = "<your steam password>";
config.steam_guard_code = "";

config.ownerId = <your account ID number, the lower 32 bits of your steam id>;
config.ownerChannel = "devilesk";
config.channel = "devilesk";
config.cmdChar = "!";
config.processUserCmdsWait = 1;
config.lastCmdSendTimeWait = 1;
config.userCmdQueueMax = 10;

config.databaseAddress = 'mongodb://localhost/';
config.databaseName = 'testDb';

config.wordListPath = './tmp/wordlist';
config.questionListPath = './tmp/all';
config.sortListPath = './tmp/sortlist';
config.ignoreListPath = './ignorelist';
config.logsPath = './logs';

config.maxHints = 1;
config.hintInterval = 1;
config.timeBetween = 1;
config.repeatQuestionDelay = 1;

config.emailNotifications = false;
config.emailHost = "";
config.emailUser = "";
config.emailPass = "";
config.emailRecipient = "";

config.unansweredThreshold = 2;
config.restartWait = 30000;

config.mongodump = 'mongodump';
config.backupTime = [0,0,0]; //hour,minute,second
config.dumpPath = './dump';
config.ftpHost = '';
config.ftpUser = '';
config.ftpPass = '';

module.exports = config;
