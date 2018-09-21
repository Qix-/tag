// Disable these errors since we (ab)use them for location
// data here. Otherwise, we'd have to write some wrappers
// that would only make things worse ._.
/* eslint-disable unicorn/new-for-builtins,no-new-wrappers */

// Also, returning a promise without `await` works just fine.
// Linters get on my nerves.
/* eslint-disable require-await */

const debug = require('debug')('tag:context');

const {TagError} = require('./error');
const pattern = require('./patterns');

class Context {
	constructor({namespace = {}, rules = {}, commands = {}} = {}) {
		this.namespace = namespace;
		this.rules = rules;
		this.commands = commands;
	}

	get(name) {
		return this.namespace[name];
	}

	set(name, spec, location) {
		const existing = this.get(name);
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

	unset(name) {
		delete this.namespace[name];
	}

	async call(namespace, name, args, location) {
		if (!this.commands[namespace]) {
			throw new TagError({location}, `unknown namespace: ${namespace}`);
		}

		if (!this.commands[namespace][name]) {
			throw new TagError({location}, `unknown command for namespace '${namespace}': ${name}`);
		}

		if (!this._namespace) {
			// Clone the namespace and create a local scope
			this._namespace = this.namespace;
			this.namespace = {...this.namespace};
		}

		debug('call %s:%s %O', namespace, name, args);
		const results = await (async () => {
			try {
				return this.commands[namespace][name](...args);
			} catch (error) {
				error.location = location;
				throw error;
			}
		})();
		debug('call(result) %s:%s %O %O', namespace, name, args, results);

		if (typeof results === 'object') {
			const keys = Object.keys(results);
			for (const key of keys) {
				const value = results[key] === undefined || results[key] === null ? '' : results[key].toString();
				this.set(key, {type: 'variable', value: [{literal: value}]}, location);
			}
		}
	}
}

function locstr(str, thing) {
	const res = new String(str);
	Object.defineProperty(res, 'location', {value: thing.location});
	return res;
}

function parseConditional(ctx, st) {
	debug('parseConditional %O', st);

	for (const conditional of st) {
		const stKey = 'tagPositive' in conditional ? 'tagPositive' : 'tagNegative';
		const value = ctx.get(conditional[stKey]);

		if (!value) {
			if (stKey === 'tagPositive') {
				return false;
			}

			continue;
		}

		if (value.type === 'tag') {
			if (Boolean(value.enabled) !== (stKey === 'tagPositive')) {
				return false;
			}

			continue;
		}

		if (value.type === 'variable') {
			if (stKey === 'tagNegative') {
				return false;
			}

			continue;
		}

		throw new TagError(conditional, `cannot use ${value.type} identifier in tag conditional`);
	}

	return true;
}

function parseFullText(ctx, args, literals = []) {
	debug('parseFullText %O', args);
	for (const arg of args) {
		debug('parseFullText(arg) %O', arg);
		if ('literal' in arg) {
			literals.push(arg.literal);
		} else if ('skip' in arg) {
			// This is full text so we actually include skips
			parseFullText(ctx, [arg.skip], literals);
		} else if ('append' in arg) {
			// This is full text so we would include appends anyway
			parseFullText(ctx, [arg.append], literals);
		} else if ('substitution' in arg) {
			const name = parseFullText(ctx, arg.substitution);
			const value = ctx.get(name);

			if (!value) {
				if (arg.optional) {
					continue;
				}

				throw new TagError(arg, `unknown variable: ${name}`);
			}

			if (value.type !== 'variable') {
				throw new TagError(arg, `attempt to reference non-variable value: ${name}`);
			}

			literals.push(parseFullText(ctx, value.value));
		} else {
			// TODO conditionals
			debug('UNKNOWN SPEC:', arg);
			throw new TagError(arg, `unknown argument spec: ${Object.keys(arg)}`);
		}
	}

	return literals.join('');
}

function parseArgs(ctx, args, results = []) {
	// A few hacks are used to keep location data.
	// Sorry in advance.

	debug('parseArgs %O', args);
	for (const arg of args) {
		debug('parseArg(arg) %O', arg);
		if ('literal' in arg) {
			results.push(locstr(arg.literal, arg));
		} else if ('skip' in arg) {
			continue;
		} else if ('append' in arg) {
			const orig = results[results.length - 1];
			results[results.length - 1] = locstr(orig + parseFullText(ctx, [arg.append]), orig);
		} else if ('substitution' in arg) {
			const name = parseFullText(ctx, arg.substitution);
			const value = ctx.get(name);

			if (!value) {
				if (arg.optional) {
					continue;
				}

				throw new TagError(arg, `unknown variable: ${name}`);
			}

			if (value.type !== 'variable') {
				throw new TagError(arg, `attempt to reference non-variable value: ${name}`);
			}

			parseArgs(ctx, value.value, results);
		} else {
			// TODO conditionals (note that conditionals can return multiple args)
			throw new TagError(arg, `unknown argument spec: ${Object.keys(arg)}`);
		}
	}

	debug('parseArgs(results) %O', results);
	return results;
}

const keywords = {
	ECHO: async (ctx, st) => ctx.call('tag', 'echo', [parseFullText(ctx, st.arguments)], st.location),

	ON: (ctx, st) => {
		const tags = parseArgs(ctx, st.arguments);

		if (tags.length === 0) {
			throw new TagError(st, 'incorrect usage: ON <tags...>');
		}

		for (const tag of tags) {
			ctx.set(tag, {type: 'tag', enabled: true});
		}
	},

	OFF: (ctx, st) => {
		const tags = parseArgs(ctx, st.arguments);

		if (tags.length === 0) {
			throw new TagError(st, 'incorrect usage: OFF <tags...>');
		}

		for (const tag of tags) {
			ctx.set(tag, {type: 'tag', enabled: false});
		}
	},

	SET: (ctx, st) => {
		const args = parseArgs(ctx, st.arguments);
		if (args.length === 0) {
			throw new TagError(st, 'incorrect usage: SET <variable_name> [args...]');
		}

		const [name, ...varargs] = args;

		ctx.set(name, {type: 'variable', value: varargs.map(a => ({literal: a}))});
	},

	UNSET: (ctx, st) => {
		const args = parseArgs(ctx, st.arguments);
		if (args.length === 0) {
			throw new TagError(st, 'incorrect usage: UNSET <args...>');
		}

		for (const arg of args) {
			ctx.unset(arg);
		}
	},

	CALL: async (ctx, st) => {
		const args = parseArgs(ctx, st.arguments);
		if (args.length === 0) {
			throw new TagError(st, 'incorrect usage: CALL <namespace:method_name> [args...]');
		}

		if (!pattern.method.test(args[0])) {
			throw new TagError(st, `invalid CALL method format (expects \`namespace:method_name\`): ${args[0]}`);
		}

		const [arg0, ...varargs] = args;
		const [namespace, methodName] = arg0.split(/:(.+)/, 2);

		return ctx.call(namespace, methodName, varargs, st.location);
	}
};

async function parseStatement(ctx, st, dontCheckIndent) {
	debug('parseStatement %O', st);

	if (!dontCheckIndent && !st.indent && ctx._namespace) {
		// Kill the local namespace (thus exiting to root scope)
		ctx.namespace = ctx._namespace;
		delete ctx._namespace;
	}

	if (st.indent && !ctx._namespace) {
		// We're not in a scope-able area and indenting isn't allowed
		throw new TagError(st, 'indentation is not allowed here');
	}

	if ('conditional' in st) {
		// Make sure it's not a BS keyword regardless of conditional
		if (!keywords[st.value.keyword]) {
			throw new TagError(st.value, `invalid keyword: ${st.value.keyword}`);
		}

		if (!parseConditional(ctx, st.conditional)) {
			return;
		}

		return parseStatement(ctx, st.value, true);
	}

	const handler = keywords[st.keyword];
	if (!handler) {
		throw new TagError(st, `invalid keyword: ${st.keyword}`);
	}

	return handler(ctx, st);
}

module.exports = {Context, parseStatement};
