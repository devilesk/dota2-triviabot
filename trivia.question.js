var fs = require("fs");
var path = require("path");
var util = require("util");
var loadFile = require("./common.js").loadFile;

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

var Hint = function Hint(answer, maxHints) {
    this.count = 0;
    
    this.value = new Array(answer.length + 1).join('*');
    for(var i = 0; i < answer.length; i++) {
        if (answer[i] === ' ' || answer[i] === '.' || answer[i] === '-') {
            this.value = this.value.replaceAt(i, answer[i]);
        }
    }
    
    this.hiddenIndices = [];
    for(var i=0; i < this.value.length; i++) {
        if (this.value[i] === '*') {
            this.hiddenIndices.push(i);
        }
    }
    this.hiddenIndices = this.hiddenIndices.shuffle();
    
    this.hiddenIndicesLength = this.hiddenIndices.length;
    this.maxHints = this.hiddenIndicesLength == 1 ? 1 : Math.min(this.hiddenIndicesLength - 1, maxHints);
    this.charsPerHint = this.hiddenIndicesLength == 1 ? 0 : Math.floor((this.hiddenIndicesLength - 1 ) / this.maxHints);
    console.log(this.hiddenIndicesLength, this.maxHints, this.charsPerHint);
    this.get = function () {
        if (this.count > 0 && this.count <= this.maxHints) {
            for(var i = 0; i < this.charsPerHint; i++) {
                var c = this.hiddenIndices.pop();
                this.value = this.value.replaceAt(c, answer[c]);
            }
        }
        this.count++;
        return this.value;
    }
}

var QuestionSource = function QuestionSource(path, data, getQuestionModifier) {
    this.path = path || '';
    this.data = data || [];
    this.loading = false;
    this.attemptsTimers = [];
    this.getQuestionModifier = getQuestionModifier || function (data) { return data };
}

QuestionSource.prototype.maxRetryAttempts = 3;
QuestionSource.prototype.retryWaitTime = 100;

QuestionSource.prototype.getQuestion = function (success, failure, attempts) {
    var self = this;
    var attempts = attempts || 0;
    if (this.loading) {
        if (attempts < this.maxRetryAttempts) {
            this.attemptsTimers.push(
                setTimeout(function () {
                    self.getQuestion(success, failure, ++attempts);
                }, self.retryWaitTime)
            );
        }
        else {
            if (failure) failure('QuestionSource getQuestion failed. Max retry attempts exceeded.');
        }
    }
    else {
        if (this.data.length === 0) {
            this.loadFile(function () {
                var data = self.data.pop().split('*');
                data = self.getQuestionModifier(data);
                success(data);
            });
        }
        else {
            var data = self.data.pop().split('*');
            data = self.getQuestionModifier(data);
            if (this.data.length === 0) this.loadFile();
            success(data);
        }
    }
}

QuestionSource.prototype.loadFile = function (callback) {
    var self = this;
    this.loading = true;
    loadFile(this.path, function (data) {
        self.data = data.trim('\n').split('\n').shuffle();
        self.loading = false;
        if (callback) callback();
    });
}

QuestionSource.prototype.destroy = function () {
    for (var i = 0; i < this.attemptsTimers.length; i++) {
        clearTimeout(this.attemptsTimers[i]);
    }
}

var SpellImmunityQuestionSource = function (pathTrue, pathFalse, data) {
    this.sources = [
        new QuestionSource(pathTrue, null),
        new QuestionSource(pathFalse, null)
    ]
}

SpellImmunityQuestionSource.prototype.loadFile = function () {
    for (var i = 0; i < this.sources.length; i++) {
        this.sources[i].loadFile();
    }
}

SpellImmunityQuestionSource.prototype.getQuestion = function(success, failure) {
    var self = this;
    var n = Math.random() < 0.5 ? 0 : 1;
	this.sources[n].getQuestion(function (data1) {
        self.sources[1 - n].getQuestion(function (data2) {
            self.sources[1 - n].getQuestion(function (data3) {
                var choices = [data1[0], data2[0], data3[0]].shuffle();
                if (n) {
                    var question = util.format("Spell Immunity: %s, %s, or %s does not pierce?", choices[0], choices[1], choices[2]);
                }
                else {
                    var question = util.format("Spell Immunity: %s, %s, or %s pierces?", choices[0], choices[1], choices[2]);
                }
                success([question, data1[0]])
            }, failure);
        }, failure);
    }, failure);
}

SpellImmunityQuestionSource.prototype.destroy = function () {
    for (var i = 0; i < this.sources.length; i++) {
        this.sources[i].destroy();
    }
}

var QuestionProducer = function QuestionProducer(config) {
    this.sources = [
        new QuestionSource(config.wordListPath, null, function (data) {
            var original = data[1].replace(/\s+/g, '').toLowerCase();
            var a = original;
            while (original === a) {
                a = a.shuffle();
            }
            data[0] = data[0] + ' ' + a;
            return data;
        }),
        new SpellImmunityQuestionSource(config.spellImmunityTruePath, config.spellImmunityFalsePath, null),
        new QuestionSource(config.questionListPath, null)
    ]
    this.loadSources();
}

QuestionProducer.prototype.loadSources = function () {
    for (var i = 0; i < this.sources.length; i++) {
        this.sources[i].loadFile();
    }
}

QuestionProducer.prototype.getQuestion = function(success, failure) {
	var n = Math.floor(Math.random()*8);
    var index = 0;
    switch (n) {
        case 0:
        case 1:
            this.sources[n].getQuestion(success, failure);
        break;
        default:
            this.sources[2].getQuestion(success, failure);
        break;
    }
}

QuestionProducer.prototype.destroy = function () {
    for (var i = 0; i < this.sources.length; i++) {
        this.sources[i].destroy();
    }
}

exports.Hint = Hint;
exports.QuestionSource = QuestionSource;
exports.QuestionProducer = QuestionProducer;