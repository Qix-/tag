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

function parseTagfile(source, filename, {namespace = {}} = {}) {
	debug('begin parsing', filename);
	const result = tagParser.parse(source + '\n', {
		namespace
	});
	debug('finished parsing', filename);
	return result;
}

module.exports = {parseTagfile};
