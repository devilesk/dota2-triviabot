dota2-triviabot
========

A dota 2 trivia bot. Points leaderboards at [dotatrivia.com](http://dotatrivia.com). Come to chat channel "Trivia" in Dota 2 to play now.

## SET UP
* Clone this repository and `npm install` in repository root.
* Edit `config_test.js` and rename to `config.js`.
* Create a blank file named 'sentry'.
* `node index.js` to launch bot. You'll receive Error 63 - which means you need to provide a Steam Guard code.
* Set the Steam Guard code in config.js and launch again.

Credit to Rob Jackson for [node-dota2](https://github.com/RJacksonm1/node-dota2)
