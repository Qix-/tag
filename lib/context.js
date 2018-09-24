// Yo, yes it's required in this case. It's not "unexpected". Linters
// annoy the hell out of me.
/* eslint-disable no-await-in-loop */

// Also, returning a promise without `await` works just fine.
// Linters get on my nerves.
/* eslint-disable require-await */

const debug = require('debug')('tag:context');
const debugEcho = require('debug')('tag:echo');

const {TagError} = require('./error');
const pattern = require('./patterns');

class BaseContext {
	/* eslint-disable no-unused-vars */
	get(name, location) {
		throw new TagError({location}, `not implemented: ${this.constructor.name}.get()`);
	}

	set(name, spec, location) {
		throw new TagError({location}, `not implemented: ${this.constructor.name}.set()`);
	}

	async unset(name, location) {
		throw new TagError({location}, `not implemented: ${this.constructor.name}.unset()`);
	}

	async echo(message, location) {
		throw new TagError({location}, `not implemented: ${this.constructor.name}.echo()`);
	}

	async error(message, location) {
		throw new TagError({location}, `not implemented: ${this.constructor.name}.error()`);
	}
	/* eslint-enable no-unused-vars */
}

class HostContext extends BaseContext {
	constructor({namespace = {}, commands = {}} = {}) {
		super();
		this.namespace = namespace;
		this.commands = commands;
	}

	async echo(message) {
		debugEcho(message);
	}

	async error(message, location) {
		throw new TagError({location}, message);
	}

	async get(name) {
		return this.namespace[name];
	}

	async set(name, spec, location) {
		const existing = await this.get(name);
		if (existing && existing.type !== spec.type) {
			throw new TagError({location}, `attempt to overwrite value of type '${existing.type}' with new value of type '${spec.type}'`);
		}

		if (spec.type === 'tag' && !pattern.tag.test(name)) {
			throw new TagError(name, `invalid tag format: ${name}`);
		}

		if (spec.type === 'variable' && !pattern.variable.test(name)) {
			throw new TagError(name, `invalid variable format: ${name}`);
		}

		debug('CTX SET', name, spec);
		this.namespace[name] = spec;
	}

	async unset(name) {
		delete this.namespace[name];
	}
}

module.exports = {BaseContext, HostContext};
