var fs = require("fs");
var path = require("path");

function loadFile(filePath, callback) {
	fs.readFile(path.resolve(__dirname, filePath), 'utf8', function(err, data) {
		if (err) throw err;
        callback(data);
	});
}

function tokenize(msg) {
    var re = /[^\s"]+|"([^"]*)"/gi,
        args = [];

    do {
        //Each call to exec returns the next regex match as an array
        var match = re.exec(msg);
        if (match != null) {
            //Index 1 in the array is the captured group if it exists
            //Index 0 is the matched text, which we use if no captured group exists
            args.push(match[1] ? match[1] : match[0]);
        }
    } while (match != null);
    return args;
}

exports.loadFile = loadFile;
exports.tokenize = tokenize;