{
	const backslash = require('backslash');

	const {namespace} = options;
}

tagfile
	= EOL? statements:(complete_statement*)
	{
		return (statements || []).filter(s => Boolean(s));
	}
	;

complete_statement
	= ws:WS? s:conditional_statement EOL
	{
		if (!s) {
			return undefined;
		}

		s.indented = Boolean(ws);
		return s;
	}
	;

conditional_statement
	= enabled:(c:tag_conditional WS {return c;})? s:statement
	{
		return (enabled !== false) ? s : undefined;
	}
	;

statement
	= cmd:command_identifier arglist:(WS l:argument_list {return l;})?
	{
		return {cmd, arglist};
	}
	;

command_identifier "command name (must be upper case)"
	= $([A-Z]+)
	;

argument_list "argument list"
	= f:(a:argument {return ['', a];})  r:(ws:WS n:argument {return [ws, n];})*
	{
		const pairs = [f].concat(r);

		const bare_arguments = [];
		const full_arguments = [];

		for (const pair of pairs) {
			full_arguments.push(pair[0]);

			if (pair[1] === null || pair[1] === undefined) {
				continue;
			};

			let bare = true;
			for (const chunk of pair[1]) {
				if (bare) {
					bare_arguments.push(chunk);
				}

				full_arguments.push(chunk);
				bare = !bare;
			}
		}

		return {args: bare_arguments, text: full_arguments.join(''), fullArgs: full_arguments};
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
		if (enabled === false) {
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
		const variable = namespace[name];
		if (!variable) {
			if (!optional) {
				error('unknown variable: ' + name);
			}

			return [];
		} else if (variable.type !== 'variable') {
			error('identifier refers to ' + variable.type + ', but expected a variable');
		}

		return variable.value;
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
		}
	}
	;

identifier "identifier"
	= $([a-z_+]i [a-z0-9_+:]i*)
	;

comment "comment"
	= '#' [^\r\n]+

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
