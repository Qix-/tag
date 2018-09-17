const debug = require('debug')('tag:api');

class TagAPI {
	constructor({namespace = {}, useDefaults = true} = {}) {
		this.namespace = namespace;
		this.visitor = s => this.visit(s);
		this.commands = {};

		if (useDefaults) {
			// TODO
		}
	}

	addCommand(name, callback) {
		debug('add command: %s', name);
	}

	visit(st) {
		debug('%O', st);
	}
};

module.exports = {TagAPI};
