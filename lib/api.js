const path = require('path');

const debug = require('debug')('tag:api');

const {TagError} = require('./error');

class TagAPI {
	constructor({namespace = {}, useDefaults = true} = {}) {
		this.namespace = namespace;
		this.commands = {};

		Object.defineProperties(this, {
			_indentAllowed: {
				writable: true,
				value: false
			},
			_indentSkipped: {
				writable: true,
				value: false
			}
		});

		if (useDefaults) {
			this.setVariable('TAGPATH', [
				path.join(__dirname, 'stdlib/%.tag'),
				'./%.tag',
				'./%',
				'./node_modules/%/index.tag',
				'./node_modules/%',
				'./node_modules/%.tag'
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

	isIndentAllowed() {
		return this._indentAllowed;
	}

	isIndentSkipped() {
		return this._indentSkipped;
	}

	visit(st, enabled) {
		debug('(%sabled) %O', enabled ? 'en' : 'dis', st);

		if (!st.indented) {
			this._indentAllowed = false;
			this._indentSkipped = false;
		}

		switch (st.cmd) {
			case 'DEF':
				if (st.indented || this._indentAllowed) {
					// Let .visit() error.
					break;
				}

				this._indentAllowed = true;
				this._indentSkipped = !enabled;

				break;
			default:
				break;
		}
	}
}

module.exports = {TagAPI};
