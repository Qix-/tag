const path = require('path');

const debug = require('debug')('tag:api');

const {TagError} = require('./error');

class TagAPI {
	constructor({namespace = {}, useDefaults = true} = {}) {
		this.namespace = namespace;
		this.commands = {};

		if (useDefaults) {
			this.setVariable('TAGPATH', [
				path.join(__dirname, 'stdlib/%.tag'),
				'./%.tag',
				'./%.js',
				'./%',
				'./node_modules/%/index.tag',
				'./node_modules/%/index.js',
				'./node_modules/%.tag',
				'./node_modules/%.js',
				'./node_modules/%'
			].join(':'));
		}
	}

	addCommand(package_, name, callback) {
		if (typeof callback !== 'function') {
			throw new TypeError('callback must be a function');
		}

		const cmdname = `${package_}:${name}`;
		if (this.commands[cmdname]) {
			throw new Error(`command already registered: ${cmdname}`);
		}

		this.commands[cmdname] = callback;
	}

	getVariable(name, optional) {
		const entry = this.namespace[name];

		if (!entry) {
			if (optional) {
				return undefined;
			}

			throw new TagError(`attempt to reference undeclared variable: ${name}`);
		}

		if (entry.type !== 'variable') {
			throw new TagError(`attempt to reference non-variable of type '${entry.type}': ${name}`);
		}

		return entry;
	}

	setVariable(name, value) {
		const entry = this.namespace[name];

		if (entry && entry.type !== 'variable') {
			throw new TagError(`attempt to set a non-variable of type '${entry.type}': ${name}`);
		}

		this.namespace[name] = {
			type: 'variable',
			value
		};
	}

	use(name) {
		try {
			/* eslint-disable no-throw-literal */
			if (!name) {
				throw 'no name supplied';
			}

			const fixedTagpath = this.namespace.TAGPATH.replace(/^:+|:+$/g, '').replace(/:+/g, ':');

			if (!this.namespace.TAGPATH) {
				throw 'TAGPATH is not specified or is zero length';
			}

			let resolved = null;
			const tried = [];


			if (!resolved) {
				throw `not found in TAGPATH:\n\ttried: ${tried.join('\n\ttried: ')}`;
			}



			/* eslint-enable no-throw-literal */
		} catch (error) {
			throw new TagError(`cannot resolve Tag module: ${error}`);
		}
	}
}

module.exports = {TagAPI};
