var fs = require("fs");
var path = require("path");
var util = require("util");
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
    this.db = null;
    this.config = config;
    this.get = function (accountId, callback, personaName) {
        this.userCollection.findOne({accountId:accountId}, function (err, user) {
            if (err) util.log('findOne error');
            if (user) {
                callback(user);
            }
            else {
                var newUser = new User(accountId, 0, 0, personaName);
                self.userCollection.insert(newUser, {w:1}, function(err, result) {
                    if (err) util.log('insert error');
                    callback(newUser);
                });            
            }
        });
    }
    this.getRank = function (accountId, callback) {
        var self = this;
        this.get(accountId, function (user) {
            self.userCollection.find({ points: { $gt: user.points } }).count(function(err, count) {
                if (err) util.log('count error');
                callback(count+1);
            });
        });
    }
    this.getTop = function (callback, type) {
        switch (type) {
            case 'all':
                this.userCollection.find().sort({points:-1}).limit(10).toArray(function(err, items){
                    if (!err) callback(items);
                });
            break;
            case 'week':
                this.scoreWeeklyCollection.aggregate([{$group:{_id: { accountId: "$accountId" }, total: { $sum: "$points" }, count: { $sum: 1 }, personaName: { $min: "$personaName" } }}, {$sort: {total: -1}}], function(err, items) {
                    if (!err) {
                        if (items.length > 10) {
                            callback(items.slice(0, 10));
                        }
                        else {
                            callback(items);
                        }
                    }
                });
            break;
            case 'day':
                this.scoreDailyCollection.aggregate([{$group:{_id: { accountId: "$accountId" }, total: { $sum: "$points" }, count: { $sum: 1 }, personaName: { $min: "$personaName" } }}, {$sort: {total: -1}}], function(err, items) {
                    if (!err) {
                        if (items.length > 10) {
                            callback(items.slice(0, 10));
                        }
                        else {
                            callback(items);
                        }
                    }
                });
            break;
            case 'hour':
            default:
                this.scoreHourlyCollection.aggregate([{$group:{_id: { accountId: "$accountId" }, total: { $sum: "$points" }, count: { $sum: 1 }, personaName: { $min: "$personaName" } }}, {$sort: {total: -1}}], function(err, items) {
                    console.log(err, items);
                    if (!err) {
                        if (items.length > 10) {
                            callback(items.slice(0, 10));
                        }
                        else {
                            callback(items);
                        }
                    }
                });
            break;
        }
    }
    this.giveUserPoints = function (accountId, personaName, pointReward) {
        this.userCollection.update({accountId:accountId}, {$inc:{points:pointReward}, $set:{personaName:personaName}}, {w:1}, function(err, result) {
            if (err) util.log('update error userCollection', accountId, personaName, pointReward);
        });
        this.scoreHourlyCollection.insert({"createdAt": new Date(), "points": pointReward, "accountId": accountId, "personaName": personaName}, {w:1}, function(err, result) {
            if (err) util.log('insert error scoreHourlyCollection', accountId, personaName, pointReward);
        });
        this.scoreDailyCollection.insert({"createdAt": new Date(), "points": pointReward, "accountId": accountId, "personaName": personaName}, {w:1}, function(err, result) {
            if (err) util.log('insert error scoreDailyCollection', accountId, personaName, pointReward);
        });
        this.scoreWeeklyCollection.insert({"createdAt": new Date(), "points": pointReward, "accountId": accountId, "personaName": personaName}, {w:1}, function(err, result) {
            if (err) util.log('insert error scoreWeeklyCollection', accountId, personaName, pointReward);
        });
    }
    this.updateUserStreak = function (accountId, streak) {
        var self = this;
        this.get(accountId, function (user) {
            if (user.bestStreak < streak) {
                self.userCollection.update({accountId:accountId}, {$set:{bestStreak:streak}}, {w:1}, function(err, result) {
                    if (err) util.log('update error userCollection', accountId, streak);
                });
            }
        });
    }
    
    var self = this;
    MongoClient.connect(this.config.databaseAddress + this.config.databaseName, function(err, db) {
        if(!err) {
            util.log("We are connected to " + self.config.databaseAddress + self.config.databaseName);
            self.db = db;
            self.db.createCollection("users", function (err, collection) {
                if (err) util.log('collection error');
                self.userCollection = collection;
            });
            self.db.createCollection("scoresHourly", function (err, collection) {
                if (err) util.log('collection error');
                self.scoreHourlyCollection = collection;
                self.scoreHourlyCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 3600 }, function (err, indexName) {});
            });
            self.db.createCollection("scoresDaily", function (err, collection) {
                if (err) util.log('collection error');
                self.scoreDailyCollection = collection;
                self.scoreDailyCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 86400 }, function (err, indexName) {});
            });
            self.db.createCollection("scoresWeekly", function (err, collection) {
                if (err) util.log('collection error');
                self.scoreWeeklyCollection = collection;
                self.scoreWeeklyCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 604800 }, function (err, indexName) {});
            });
        }
        else {
            util.log("Not connected to " + self.config.databaseAddress + self.config.databaseName);
        }

    });
}

exports.User = User;
exports.UserCollection = UserCollection;
