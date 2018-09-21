// NOTE: this is the default set of functionality
//       USE'd by default. Be careful what you do
//       in here.

const debugEcho = require('debug')('tag:echo');

const {TagError} = require('../error');

function echo(location, ...message) {
	debugEcho('%s', message.map(s => s.toString()).join(' '));
}

function error(location, ...message) {
	throw new TagError(location, message.map(s => s.toString()).join(' '));
}

module.exports = {
	namespace: 'tag',
	commands: {
		echo,
		error
	}
};
