{
	const path = require('path');

	const backslash = require('backslash');
	const {findBestMatch} = require('string-similarity');

	const api = options;

	let currentStatementSkipped = false;
	let allowIndent = false;
	let skipIndent = false;
	let currentKeyword;
	let currentKeywordName;

	/*
		narg: [min, max] - number of arguments (REQUIRED)
		visit: (statement, api) => Any - handles an enabled, valid statement with the keyword (REQUIRED)
		rootOnly: true|false - if true, keyword cannot appear in indent blocks
		allowIndent: true|false - if true, keyword can have an indentation body
	*/
	const keywords = {
		'USE': {
			narg: [1, 1],
			rootOnly: true,
			visit: (st, api) => api.use(st.arglist.args[0])
		},
		'RULE': {
			narg: [2, Infinity],
			allowIndent: true,
			rootOnly: true,
			visit: (st, api) => false // TODO
		},
		'RUN': {
			narg: [1, Infinity],
			visit: (st, api) => false // TODO
		},
		'ECHO': {
			narg: [1, Infinity],
			visit: (st, api) => api.echo(st.arglist.text)
		},
		'ON': {
			narg: [1, Infinity],
			visit: (st, api) => {
				for (const tag of st.arglist.args) {
					api.on(tag);
				}
			}
		},
		'OFF': {
			narg: [1, Infinity],
			visit: (st, api) => {
				for (const tag of st.arglist.args) {
					api.off(tag);
				}
			}
		}
	};
}

tagfile
	= EOL? statements:(complete_statement*)
	{
		return true;
	}
	;

complete_statement
	= indent:indentation? enabled:(c:tag_conditional WS {return c;})? s:statement EOL
	{
		try {
			if (currentStatementSkipped) {
				return undefined;
			}

			s.enabled = enabled !== false; // required for cases where no tags exist
			s.indented = Boolean(indent);

			if (s.indented) {
				if (currentKeyword.rootOnly) {
					error(`keyword cannot be used from within indented block: ${currentKeywordName}`);
				}

				s.enabled = s.enabled && !skipIndent;

				// TODO automatically handle blocks and
				//      defer visit until a non-indented
				//      statement happens.
			} else {
				allowIndent = currentKeyword.allowIndent;
				skipIndent = !s.enabled;
			}
		} catch (err) {
			if (err.constructor.name === 'TagError') {
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

			const variable = api.getVariable(name, optional);

			if (!variable) {
				return [];
			} else if (variable.type !== 'variable') {
				error('identifier refers to ' + variable.type + ', but expected a variable');
			}

			return [variable.value];
		} catch (err) {
			if (err.constructor.name === 'TagError') {
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
		const tag = api.namespace[path];
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
