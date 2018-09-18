const fs = require('fs');
const path = require('path');

const debug = require('debug')('tag:parser');
const pegjs = require('pegjs');

const tagGrammar = fs.readFileSync(path.join(__dirname, 'tag.pegjs'), 'utf-8');
debug('opened Tag grammar');

const tagParser = pegjs.generate(tagGrammar, {
	allowedStartRules: ['tagfile']
});
debug('generated Tag parser');

function parseTagfile(source, filename, {namespace, commands, api} = {}) {
	debug('begin parsing', filename);

	if (!api) {
		throw new TypeError('api must be specified');
	}

	// TODO remove basePath if https://github.com/pegjs/pegjs/issues/363#issuecomment-422193636 is resolved
	tagParser.parse(source + '\n', {
		api,
		namespace,
		commands,
		basePath: __dirname
	});

	debug('finished parsing', filename);
}

module.exports = {parseTagfile};
