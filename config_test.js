var config = {};

config.steam_name = "<steam bot alias>";
config.steam_user = "<steam username>";
config.steam_pass = "<steam password>";
config.steam_guard_code = "";

config.messages = {};
config.messages.steamChatAutoReply = "Hello, I'm a bot. Right now, I'm only capable of accepting item donations via trade and running trivia in-game.";
config.messages.help = "Available commands: !stats, !top scores, !top streaks, !question.\nTo send a message to the bot owner use: !report <msg>.\nYou are limited to one command every five minutes.";
config.messages.answer = "Time\'s up! The answer is %s.%s";
config.messages.welcome + "%s has entered the channel."
config.restartPrompt = "Bot suspects that its questions aren't being seen and will restart in 30 seconds. Say !cancel if you can see this message to prevent restart.";

config.ownerId = <your account ID number, the lower 32 bits of your steam id>;
config.ownerId64 = "<your account Steam64 ID number>";
config.ownerChannel = "devilesk2";
config.channel = "devilesk3";
config.cmdChar = "!";
config.processUserCmdsWait = 5000;
config.lastCmdSendTimeWait = 60000;
config.userCmdQueueMax = 10;

config.databaseAddress = "mongodb://localhost/";
config.databaseName = "testDb2";

config.wordListPath = "./questions/wordlist";
config.questionListPath = "./questions/all";
config.spellImmunityTruePath = "./questions/pierces_immunity_true";
config.spellImmunityFalsePath = "./questions/pierces_immunity_false";
config.ignoreListPath = "./ignorelist";
config.logsPath = "./logs";

config.sendMessageDelay = 1000;
config.maxHints = 6;
config.hintInterval = 10000;
config.timeBetween = 5000;
config.repeatQuestionDelay = 30000;
config.unansweredThreshold = 3000000;
config.restartWait = 30000;

module.exports = config;
