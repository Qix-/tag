const debugEcho = require('debug')('tag:echo');

function echo(...message) {
	debugEcho('%s', message.map(s => s.toString()).join(' '));
}

module.exports = {
	echo
};
