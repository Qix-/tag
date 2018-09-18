const debugEcho = require('debug')('tag:echo');

// XXX DEPRECATED - to be removed in lieu of handlers.

class TagAPI {
	echo(message) {
		debugEcho(message);
	}
}

module.exports = {TagAPI};
