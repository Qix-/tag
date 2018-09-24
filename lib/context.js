// Yo, yes it's required in this case. It's not "unexpected". Linters
// annoy the hell out of me.
/* eslint-disable no-await-in-loop */

// Also, returning a promise without `await` works just fine.
// Linters get on my nerves.
/* eslint-disable require-await */

const path = require('path');

const debug = require('debug')('tag:context');

const {TagError} = require('./error');
const pattern = require('./patterns');
const {resolvePath} = require('./resolve-path');

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

	async use(name, location) {
		throw new TagError({location}, `not implemented: ${this.constructor.name}.use()`);
	}

	async call(namespace, name, args, location) {
		throw new TagError({location}, `not implemented: ${this.constructor.name}.call()`);
	}
	/* eslint-enable no-unused-vars */
}

class HostContext extends BaseContext {
	constructor({namespace = {}, commands = {}} = {}) {
		super();
		this.namespace = namespace;
		this.commands = commands;
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

	async use(name, location) {
		const tagpath = await this.get('TAGPATH');

		if (!tagpath || tagpath.type !== 'variable') {
			throw new TagError({location}, 'TAGPATH is not set or is not a variable; cannot USE anything!');
		}

		if (tagpath.value.length === 0) {
			throw new TagError({location}, 'TAGPATH is set to an empty value; cannot USE anything!');
		}

		if (tagpath.value.length > 1) {
			throw new TagError({location}, `TAGPATH can only have one argument; currently has ${tagpath.value.length}`);
		}

		if (!('literal' in tagpath.value[0])) {
			throw new TagError({location}, 'TAGPATH must be a literal value');
		}

		const tries = [];
		const resolved = await (() => {
			try {
				return resolvePath(name, tagpath.value[0].literal, tries);
			} catch (error) {
				error.location = location;
				throw error;
			}
		})();

		if (!resolved) {
			throw new TagError({location}, `could not USE '${name}' - could not be resolved. Tried:\n        -${tries.join('\n        -')}`);
		}

		debug('resolve', name, resolved);

		const extension = path.extname(resolved);

		if (extension === '.js') {
			const plugin = (() => {
				try {
					return require(resolved);
				} catch (error) {
					error.location = location;
					throw error;
				}
			})();

			if (typeof plugin !== 'object') {
				throw new TagError({location}, `invalid plugin return value - expected an object, got ${typeof plugin}: ${resolved}`);
			}

			if (!plugin.namespace) {
				throw new TagError({location}, `plugin does not export a \`namespace\` property: ${resolved}`);
			}

			// TODO better type checking here
			if (typeof plugin.namespace === 'object') {
				const keys = Object.keys(plugin.namespace);
				for (const key of keys) {
					debug('plugin %s set namespace %s %O', name, key, plugin.namespace[key]);
					await this.set(key, plugin.namespace[key], location);
				}
			}

			// TODO better type checking here
			if (typeof plugin.commands === 'object') {
				if (this.commands[plugin.namespace]) {
					throw new TagError({location}, `plugin is attempting to overwrite existing namespace '${plugin.namespace}': ${resolved}`);
				}

				// TODO way better type checking here. should be a flat {String => Function} map,
				// as per anubis/tag#4.
				this.commands[plugin.namespace] = plugin.commands;
			}
		} else if (extension === '.tag') {
			// TODO
			throw new TagError({location}, 'FIXME: .tag file inclusion is not yet supported');
		} else {
			throw new TagError({location}, `resolved a 'USE ${name}' statement to '${resolved}' but it's not a supported format (open a ticket!)`);
		}
	}

	async call(namespace, name, args, location) {
		if (!this.commands[namespace]) {
			throw new TagError({location}, `unknown namespace: ${namespace}`);
		}

		if (!this.commands[namespace][name]) {
			throw new TagError({location}, `unknown command for namespace '${namespace}': ${name}`);
		}

		debug('call %s:%s %O', namespace, name, args);
		const results = await (async () => {
			try {
				return this.commands[namespace][name]({
					location,
					namespace: this.namespace,
					args
				});
			} catch (error) {
				error.location = location;
				throw error;
			}
		})();
		debug('call(result) %s:%s %O %O', namespace, name, args, results);

		if (typeof results === 'object') {
			const keys = Object.keys(results);
			for (const key of keys) {
				const value = results[key];

				if (!value || !value.type) {
					throw new TagError({location}, `bad CALL to '${namespace}:${name}': result '${key}' is not a valid namespace element (either falsey or no \`type\` property)`);
				}

				await this.set(key, value, location);
			}
		}
	}
}

module.exports = {BaseContext, HostContext};
