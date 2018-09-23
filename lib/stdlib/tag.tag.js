// NOTE: this is the default set of functionality
//       USE'd by default. Be careful what you do
//       in here.

const debugEcho = require('debug')('tag:echo');

const {TagError} = require('../error');

function echo({args}) {
	debugEcho('%s', args.map(s => s.toString()).join(' '));
}

function error({location, args}) {
	throw new TagError(location, args.map(s => s.toString()).join(' '));
}

module.exports = {
	namespace: 'tag',
	commands: {
		echo,
		error
	}
};
