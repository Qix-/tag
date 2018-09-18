{
	const {
		api,
		basePath,
		namespace = {},
		commands = {}
	} = options;

	const path = require('path');

	const backslash = require('backslash');
	const debug = require('debug')('tag:parse');
	const {findBestMatch} = require('string-similarity');

	// TODO This is a hack to allieviate https://github.com/pegjs/pegjs/issues/363#issuecomment-422193636
	function libRequire(thing) {
		const libpath = path.join(basePath, thing);
		return require(libpath);
	}

	const {resolveAgainst} = libRequire('./resolve-path');

	class TagError extends Error {
	}

	let currentStatementSkipped = false;
	let allowIndent = false;
	let skipIndent = false;
	let currentKeyword;
	let currentKeywordName;
	let currentBlock;
	let currentBlockStatement;
	let currentBlockKeyword;
	let currentBlockLocation;
	let currentBlockKeywordName;

	function getVariable(name, optional) {
		const entry = namespace[name];

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

	function setVariable(name, value) {
		const entry = namespace[name];

		if (entry && entry.type !== 'variable') {
			throw new TagError(`attempt to set a non-variable of type '${entry.type}': ${name}`);
		}

		namespace[name] = {
			type: 'variable',
			value
		};
	}

	function use(name) {
		try {
			/* eslint-disable no-throw-literal */
			if (!name) {
				throw 'no name supplied';
			}

			if (!namespace.TAGPATH) {
				throw 'TAGPATH is not specified or is zero length';
			}

			if (namespace.TAGPATH.type !== 'variable') {
				throw `TAGPATH is not a variable: ${namespace.TAGPATH.type}`;
			}

			const fixedTagpath = namespace.TAGPATH.value.replace(/^:+|:+$/g, '').replace(/:+/g, ':');

			const tried = [];
			const resolved = resolveAgainst(name, fixedTagpath, tried);

			if (!resolved) {
				throw `not found in TAGPATH: ${name}\n    tried ${tried.join('\n    tried ')}`;
			}

			debug('resolved \'%s\' -> \'%s\'', name, resolved);

			/* eslint-enable no-throw-literal */
		} catch (error) {
			throw new TagError(`cannot resolve Tag module: ${error}`);
		}
	}

	function checkEmitBlock() {
		if (currentBlock) {
			const argSpec = currentBlockKeyword.nblock;
			const argLength = currentBlock.length;
			if (argLength < argSpec[0]) {
				error(`too few block statements for ${currentBlockKeywordName}: expected ${argSpec[0]}, got ${argLength}`, currentBlockLocation);
			}

			if (argLength > argSpec[1]) {
				error(`too many block statements for ${currentBlockKeywordName}: maximum ${argSpec[1]}, got ${argLength}`, currentBlockLocation);
			}

			currentBlockKeyword.visit(currentBlockStatement, currentBlock);

			currentBlock = null;
			currentBlockStatement = null;
			currentBlockKeyword = null;
			currentBlockLocation = null;
			currentBlockKeywordName = null;
		}
	}

	/*
		narg: [min, max] - number of arguments (REQUIRED)
		visit: (statement, api) => Any - handles an enabled, valid statement with the keyword (REQUIRED)
		rootOnly: true|false - if true, keyword cannot appear in indent blocks
		allowIndent: true|false - if true, keyword can have an indentation body
		nblock: [min, max] - number of allowed block statements (REQUIRED if allowIndent is true)
	*/
	const keywords = {
		'USE': {
			narg: [1, 1],
			rootOnly: true,
			visit: al => use(al.args[0])
		},
		'RULE': {
			narg: [2, Infinity],
			allowIndent: true,
			nblock: [0, Infinity],
			rootOnly: true,
			visit: (al, block) => {
				// TODO generate a rule spec
			}
		},
		'RUN': {
			narg: [1, Infinity],
			visit: al => false // TODO
		},
		'ECHO': {
			narg: [1, Infinity],
			visit: al => api.echo(al.text)
		},
		'ON': {
			narg: [1, Infinity],
			visit: al => {
				for (const tag of al.args) {
					setTag(tag, true);
				}
			}
		},
		'OFF': {
			narg: [1, Infinity],
			visit: al => {
				for (const tag of al.args) {
					setTag(tag, false);
				}
			}
		},
		'SET': {
			narg: [2, Infinity],
			visit: al => {
				setVariable(st.arglist.args[0], al.full.slice(3).join(''));
			}
		}
	};
}

tagfile
	= EOL? statements:(complete_statement*)
	{
		// Emit any final blocks
		checkEmitBlock();
	}
	;

complete_statement
	= indent:indentation? senabled:(c:tag_conditional WS {return c;})? s:statement EOL
	{
		try {
			if (currentStatementSkipped) {
				return undefined;
			}

			let enabled = senabled !== false; // required for cases where no tags exist
			const indented = Boolean(indent);

			if (indented) {
				if (currentKeyword.rootOnly) {
					error(`keyword cannot be used from within indented block: ${currentKeywordName}`);
				}

				enabled = enabled && !skipIndent;

				if (enabled) {
					// TODO figure out elegant way to expand an entire rule.
					currentBlock.push(currentKeyword.visit(s));
				}
			} else {
				allowIndent = currentKeyword.allowIndent;
				skipIndent = !enabled;

				checkEmitBlock();

				if (currentKeyword.allowIndent) {
					currentBlock = [];
					currentBlockStatement = s;
					currentBlockKeyword = currentKeyword;
					currentBlockKeywordName = currentKeywordName;
					currentBlockLocation = location();
				} else {
					currentKeyword.visit(s);
				}
			}
		} catch (err) {
			if (err instanceof TagError) {
				error(err.message);
			} else {
				throw err;
			}
		} finally {
			currentStatementSkipped = false;
		}
	}
	;

statement
	= keyword:command_identifier arglist:(WS l:argument_list {return l;})?
	{
		const argSpec = currentKeyword.narg;
		const argLength = arglist.args.length;

		if (argLength < argSpec[0]) {
			error(`too few arguments for ${keyword}: expected ${argSpec[0]}, got ${argLength}`);
		}
		if (argLength > argSpec[1]) {
			error(`too many arguments for ${keyword}: maximum ${argSpec[1]}, got ${argLength}`);
		}

		return arglist;
	}
	;

command_identifier "command name (must be upper case)"
	= $([A-Z]+)
	{
		currentKeyword = keywords[text()];
		currentKeywordName = text();
		if (!currentKeyword) {
			const bestMatch = findBestMatch(text(), Object.keys(keywords)).bestMatch;
			if (bestMatch.rating >= 0.6) {
				error(`unknown keyword '${text()}' (you may want '${bestMatch.target}')`);
			} else {
				error(`unknown keyword '${text()}'`);
			}
		}

		return text();
	}
	;

argument_list "argument list"
	= f:(a:argument {return ['', a];})  r:(ws:WS n:argument {return [ws, n];})*
	{
		const pairs = [f].concat(r);

		const bareArguments = [];
		const fullArguments = [];

		for (const pair of pairs) {
			fullArguments.push(pair[0]);

			if (pair[1] === null || pair[1] === undefined) {
				continue;
			};

			let bare = true;
			for (const chunk of pair[1]) {
				if (bare) {
					bareArguments.push(chunk);
				}

				fullArguments.push(chunk);
				bare = !bare;
			}
		}

		return {args: bareArguments, text: fullArguments.join(''), fullArgs: fullArguments};
	}
	;

argument
	= quoted_string
	/ substitution
	/ basic_argument
	;

basic_argument
	= chars:(basic_char+)
	{
		return [chars.join('')];
	}
	;

basic_char
	= escape_sequence
	/ (qs:quoted_string { return qs.join(''); })
	/ argument_chars
	;

quoted_string
	= '`' chars:quoted_char* '`'
	{
		const segments = [];
		for (const c of chars) {
			if (typeof c === 'string') {
				segments.push(c);
			} else {
				segments.push(c.join(''));
			}
		}

		return [segments.join('')];
	}
	;

quoted_char
	= substitution
	/ escape_sequence
	/ argument_chars
	/ literal_right_bracket
	/ WS
	;

literal_right_bracket
	= '}'
	{
		return {args: ['\x7d'], text: '\x7d'};
	}
	;

argument_chars
	= $([^\r\n`{\t \\#}]+)
	;

escape_sequence
	= '\\' ('u' HEX HEX HEX HEX / 'x' HEX HEX / [a-z0{}`\\])
	{
		const r = backslash(text());
		return {args: [r], text: r};
	}
	;

substitution
	= '{' expr:substitution_expression '}'
	{
		return expr;
	}
	;

substitution_expression
	= conditional_substitution_expression
	/ variable_reference
	;

conditional_substitution_expression
	= enabled:tag_conditional WS  value:(substitution / argument_list)
	{
		if (enabled === false || skipVariableLookup) {
			return [];
		}

		/* slice 1 here because argument_list guarantees an empty string as the first
		   full arg */
		/* TODO this feels like a hack. let's improve it. */
		return (value && value.fullArgs) ? value.fullArgs.slice(1) : value;
	}
	;

variable_reference
	= optional:'?'? name:(substitution / identifier)
	{
		try {
			// avoid exceptions for statements we don't care about.
			if (currentStatementSkipped) {
				return [];
			}

			const variable = getVariable(name, optional);

			if (!variable) {
				return [];
			} else if (variable.type !== 'variable') {
				error('identifier refers to ' + variable.type + ', but expected a variable');
			}

			return [variable.value];
		} catch (err) {
			if (err instanceof TagError) {
				error(err.message);
			} else {
				throw err;
			}
		}
	}
	;

tag_conditional
	= phrases:(f:tag_condition r:(WS t:tag_condition {return t;})* {return [f].concat(r);})
	{
		for (const phrase of phrases) {
			if (!phrase) {
				return false;
			}
		}

		return true;
	}
	;

tag_condition "tag condition"
	= positive:[@!] path:identifier
	{
		const tag = namespace[path];
		if (!tag) {
			return positive === '!';
		} else if (tag.type === 'variable') {
			return positive === '@';
		} else if (tag.type === 'tag') {
			/*
				             positive
				              ┌─┬─┐
				              │@│!│
				            ┌─┼─┼─┤
				            │T│T│F│┐
				tag.enabled ├─┼─┼─┤├ result
				            │F│F│T│┘
				            └─┴─┴─┘
			*/
			return (positive === '@') === tag.enabled;
		} else {
			error(`attempt to reference a non-tag or non-variable of type '${tag.type}': ${path}`);
		}
	}
	;

identifier "identifier"
	= $([a-z_+]i [a-z0-9_+:]i*)
	;

comment "comment"
	= '#' [^\r\n]+
	;

indentation "indentation"
	= $('\t' / ' '+)
	{
		if (!allowIndent) {
			error('unexpected indentation (previous statement doesn\'t allow indented blocks)');
		}

		if (skipIndent) {
			currentStatementSkipped = true;
		}

		return text();
	}
	;

HEX
	= [a-f0-9]i
	;

NL "newline"
	= '\r'? '\n'
	;

EOL "EOL"
	= (WS? comment? NL)+
	{
		return undefined;
	}
	;

WS "whitespace"
	= $([\t ]+)
	;
