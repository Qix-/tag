const debugEcho = require('debug')('tag:echo');

const {TagError} = require('../error');

function echo(location, ...message) {
	debugEcho('%s', message.map(s => s.toString()).join(' '));
}

function error(location, ...message) {
	throw new TagError(location, message.map(s => s.toString()).join(' '));
}

module.exports = {
	echo,
	error
};
