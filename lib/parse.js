// Disable these errors since we (ab)use them for location
// data here. Otherwise, we'd have to write some wrappers
// that would only make things worse ._.
/* eslint-disable unicorn/new-for-builtins,no-new-wrappers */

// Also, returning a promise without `await` works just fine.
// Linters get on my nerves.
/* eslint-disable require-await */

// Also, ternaries look better when broken into separate lines
// with the operators preceeding them.
/* eslint-disable operator-linebreak */

// Also, linters shouldn't tell me how or how not to program.
// Sometimes, await in a loop is mandatory to have correct logic.
// There is no way to have promises execute truly sequentially without
// it, aside from using a bunch of awkard `.then` syntax, which is dumb.
/* eslint-disable no-await-in-loop */

// Also, I like redundant uses of await in return values because it
// reminds me that certain calls are asynchronous. This is hairy code,
// no need to ambiguate it with arbitrary linter rules.
/* eslint-disable no-return-await */

const debug = require('debug')('tag:parse');

const {findBestMatch} = require('string-similarity');
const {TagError} = require('./error');
const pattern = require('./patterns');

/*
XXX to be used. Linters are (((annoying))).
function enterLocalNamespace(ctx) {
	if (!ctx._namespace) {
		// Clone the namespace and create a local scope
		ctx._namespace = ctx.namespace;
		ctx.namespace = {...ctx.namespace};
	}
}
*/

function locstr(str, thing) {
	const res = new String(str);
	Object.defineProperty(res, 'location', {value: thing.location});
	return res;
}

async function parseConditional(ctx, st) {
	debug('parseConditional %O', st);

	for (const conditional of st) {
		const stKey = 'tagPositive' in conditional ? 'tagPositive' : 'tagNegative';
		const value = await ctx.get(conditional[stKey]);

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

async function parseArgs(ctx, args, results = []) {
	// A few hacks are used to keep location data.
	// Sorry in advance.

	debug('parseArgs %O', args);
	for (const arg of args) {
		debug('parseArg(arg) %O', arg);
		if ('literal' in arg) {
			results.push(locstr(arg.literal, arg));
		} else if ('append' in arg) {
			const orig = results[results.length - 1];
			const varargs = await parseArgs(ctx, [arg.append]);
			if (varargs.length > 0) {
				results[results.length - 1] = locstr(orig + ' ' + varargs.join(' '), orig);
			}
		} else if ('substitution' in arg) {
			const varargs = await parseArgs(ctx, arg.substitution);

			if (varargs.length === 0) {
				throw new TagError(arg, 'cannot substitute: variable name evaluates to null');
			}

			if (varargs.length > 1) {
				throw new TagError(arg, 'cannot substitute: variable name evaluates to multiple arguments');
			}

			const name = varargs[0];
			const value = await ctx.get(name);

			if (!value) {
				if (arg.optional) {
					continue;
				}

				throw new TagError(arg, `unknown variable: ${name}`);
			}

			if (value.type !== 'variable') {
				throw new TagError(arg, `attempt to reference non-variable value: ${name}`);
			}

			await parseArgs(ctx, value.value, results);
		} else {
			// TODO conditionals (note that conditionals can return multiple args)
			throw new TagError(arg, `unknown argument spec: ${Object.keys(arg)}`);
		}
	}

	debug('parseArgs(results) %O', results);
	return results;
}

const keywords = {
	ECHO: async (ctx, st) => {
		const args = await parseArgs(ctx, st.arguments);
		if (args.length === 0) {
			throw new TagError(st, 'incorrect usage: ECHO <args...>');
		}

		await ctx.echo(args.join(' '), st.location);
	},

	ERROR: async (ctx, st) => {
		const args = await parseArgs(ctx, st.arguments);
		if (args.length === 0) {
			throw new TagError(st, 'incorrect usage: ERROR <args...>');
		}

		await ctx.error(args.join(' '), st.location);
	},

	ON: async (ctx, st) => {
		const tags = await parseArgs(ctx, st.arguments);

		if (tags.length === 0) {
			throw new TagError(st, 'incorrect usage: ON <tags...>');
		}

		await Promise.all(tags.map(async tag => await ctx.set(tag, {type: 'tag', enabled: true})));
	},

	OFF: async (ctx, st) => {
		const tags = await parseArgs(ctx, st.arguments);

		if (tags.length === 0) {
			throw new TagError(st, 'incorrect usage: OFF <tags...>');
		}

		await Promise.all(tags.map(async tag => await ctx.set(tag, {type: 'tag', enabled: false})));
	},

	SET: async (ctx, st) => {
		const args = await parseArgs(ctx, st.arguments);
		if (args.length === 0) {
			throw new TagError(st, 'incorrect usage: SET <variable_name> [args...]');
		}

		const [name, ...varargs] = args;

		await ctx.set(name, {type: 'variable', value: varargs.map(a => ({literal: a}))});
	},

	UNSET: async (ctx, st) => {
		const args = await parseArgs(ctx, st.arguments);
		if (args.length === 0) {
			throw new TagError(st, 'incorrect usage: UNSET <args...>');
		}

		await Promise.all(args.map(async arg => await ctx.unset(arg)));
	},

	CALL: async (ctx, st) => {
		const args = await parseArgs(ctx, st.arguments);
		if (args.length === 0) {
			throw new TagError(st, 'incorrect usage: CALL <namespace:method_name> [args...]');
		}

		if (!pattern.method.test(args[0])) {
			throw new TagError(st, `invalid CALL method format (expects \`namespace:method_name\`): ${args[0]}`);
		}

		const [arg0, ...varargs] = args;
		const [namespace, methodName] = arg0.split(/:([^:]+)$/, 2);

		await ctx.call(namespace, methodName, varargs, st.location);
	},

	USE: async (ctx, st) => {
		const args = await parseArgs(ctx, st.arguments);
		if (args.length !== 1) {
			throw new TagError(st, 'incorrect usage: USE <name>');
		}

		await ctx.use(args[0], st.location);
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

		if (!await parseConditional(ctx, st.conditional)) {
			return;
		}

		return await parseStatement(ctx, st.value, true);
	}

	const handler = keywords[st.keyword];
	if (!handler) {
		const {bestMatch} = findBestMatch(st.keyword, Object.keys(keywords));
		const bestMatchString = bestMatch && bestMatch.rating > 0.6
			? ` (did you mean ${bestMatch.target}?)`
			: '';

		throw new TagError(st, `invalid keyword: ${st.keyword}${bestMatchString}`);
	}

	return handler(ctx, st);
}

module.exports = {parseStatement};
