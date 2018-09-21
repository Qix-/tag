const debug = require('debug')('tag:context');
const debugEcho = require('debug')('tag:echo');

const {TagError} = require('./error');

class Context {
	constructor({namespace = {}, rules = {}, commands = {}} = {}) {
		this.namespace = namespace;
		this.localNamespace = null;
		this.rules = rules;
		this.commands = commands;
	}

	get(name) {
		return (this.localNamespace && this.localNamespace[name]) || this.namespace[name];
	}

	echo(message) {
		debugEcho(message);
	}
}

function parseConditional(ctx, st) {
	if (!('conditional' in st)) {
		return true;
	}

	for (const conditional of st) {
		const stKey = 'tagPositive' in st ? 'tagPositive' : 'tagNegative';
		const value = ctx.get(st[stKey]);

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
	debug('parseFullText', args);
	for (const arg of args) {
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

			literals.push(value.value);
		} else {
			throw new TagError(arg, `unknown argument spec: ${Object.keys(arg)}`);
		}
	}

	debug('parseFullText(literals)', literals);
	return literals.join('');
}

function parseStatement(ctx, st) {
	debug('parseStatement', st);
	if ('conditional' in st) {
		if (!parseConditional(ctx, st.conditional)) {
			return;
		}

		return parseStatement(ctx, st.conditional);
	}

	switch (st.keyword) {
		case 'ECHO':
			ctx.echo(parseFullText(ctx, st.arguments));
			break;
		default:
			throw new TagError(st, `unknown keyword: ${st.keyword}`);
	}
}

module.exports = {Context, parseStatement};
