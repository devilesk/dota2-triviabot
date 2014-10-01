global.config = require("./config_test");

var fs = require("fs");
var path = require("path");
var MongoClient = require('mongodb').MongoClient;
//var MongoClient = require('./tests/mock.mongodb.js').MongoClient;

var User = function User(accountId, points, bestStreak, personaName) { 
    this.accountId = accountId || 0;
    this.points = points || 0;
    this.bestStreak = bestStreak || 0;
    this.personaName = personaName || '';
}

var UserCollection = function UserCollection(config) {
    this.userCollection = null;
    this.scoreHourlyCollection = null;
    this.scoreDailyCollection = null;
    this.scoreWeeklyCollection = null;
    this.scoreMonthlyCollection = null;
    this.db = null;
    this.config = config;
    this.get = function (accountId, callback) {
        this.userCollection.findOne({accountId:accountId}, function (err, user) {
            if (err) console.log('findOne error');
            if (user) {
                callback(user);
            }
            else {
                var newUser = new User(accountId);
                self.userCollection.insert(newUser, {w:1}, function(err, result) {
                    if (err) console.log('insert error');
                    callback(newUser);
                });            
            }
        });
    }
    this.getRank = function (accountId, callback) {
        var self = this;
        this.get(accountId, function (user) {
            self.userCollection.find({ points: { $gt: user.points } }).count(function(err, count) {
                if (err) console.log('count error');
                callback(count+1);
            });
        });
    }
    this.giveUserPoints = function (accountId, personaName, pointReward) {
        this.userCollection.update({accountId:accountId}, {$inc:{points:pointReward}, $set:{personaName:personaName}}, {w:1}, function(err, result) {
            if (err) console.log('update error');
        });
        this.scoreHourlyCollection.insert({"createdAt": new Date(), "points": pointReward, "accountId": accountId}, {w:1}, function(err, result) {
            if (err) console.log('insert error');
        });
        this.scoreDailyCollection.insert({"createdAt": new Date(), "points": pointReward, "accountId": accountId}, {w:1}, function(err, result) {
            if (err) console.log('insert error');
        });
        this.scoreWeeklyCollection.insert({"createdAt": new Date(), "points": pointReward, "accountId": accountId}, {w:1}, function(err, result) {
            if (err) console.log('insert error');
        });
        this.scoreMonthlyCollection.insert({"createdAt": new Date(), "points": pointReward, "accountId": accountId}, {w:1}, function(err, result) {
            if (err) console.log('insert error');
        });
    }
    this.updateUserStreak = function (accountId, streak) {
        var self = this;
        this.get(accountId, function (user) {
            if (user.bestStreak < streak) {
                self.userCollection.update({accountId:accountId}, {$set:{bestStreak:streak}}, {w:1}, function(err, result) {
                    if (err) console.log('update error');
                });
            }
        });
    }
    
    var self = this;
    MongoClient.connect(this.config.databaseAddress + this.config.databaseName, function(err, db) {
        if(!err) {
            console.log("We are connected to " + self.config.databaseAddress + self.config.databaseName);
            self.db = db;
            self.db.createCollection("users", function (err, collection) {
                if (err) console.log('collection error');
                self.userCollection = collection;
            });
            self.db.createCollection("scoresHourly", function (err, collection) {
                if (err) console.log('collection error');
                self.scoreHourlyCollection = collection;
                console.log(err);
                self.scoreHourlyCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 10 }, function (err, indexName) {});
            });
            self.db.createCollection("scoresDaily", function (err, collection) {
                if (err) console.log('collection error');
                self.scoreDailyCollection = collection;
                console.log(err);
                self.scoreDailyCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 240 }, function (err, indexName) {});
            });
            self.db.createCollection("scoresWeekly", function (err, collection) {
                if (err) console.log('collection error');
                self.scoreWeeklyCollection = collection;
                console.log(err);
                self.scoreWeeklyCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 1680 }, function (err, indexName) {});
            });
            self.db.createCollection("scoresMonthly", function (err, collection) {
                if (err) console.log('collection error');
                self.scoreMonthlyCollection = collection;
                console.log(err);
                self.scoreMonthlyCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 52080 }, function (err, indexName) {});
            });
        }
        else {
            console.log("Not connected to " + self.config.databaseAddress + self.config.databaseName);
        }

    });
}

exports.User = User;
exports.UserCollection = UserCollection;