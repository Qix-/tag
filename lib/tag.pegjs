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
	= cmd:command_identifier args:(WS l:argument_list {return l;})?
	{
		return {cmd, args};
	}
	;

command_identifier "command name (must be upper case)"
	= $([A-Z]+)
	;

argument_list "argument list"
	= f:argument r:(ws:WS a:argument {return [ws, a];})*
	{
		const args = [];
		const all_args = [];

		if (!(f === null || f === undefined)) {
			args.push(f);
			all_args.push(f);
		}

		for (const rest of r) {
			if (rest[1] === null || rest[1] === undefined) {
				continue;
			}

			args.push(rest[1]);
			all_args.push(rest[0], rest[1]);
		}
		return {args, text: all_args.join('')};
	}
	;

argument "argument"
	= phrases:argument_phrase+
	{
		phrases = phrases.filter(p => !(p === null || p === undefined));

		if (phrases.length === 0) {
			return undefined;
		}

		return phrases.join('');
	}
	;

argument_phrase
	= quoted_string
	/ substitution
	/ escape_sequence
	/ argument_chars
	;

quoted_string
	= '`' chars:quoted_char* '`'
	{
		return chars.join('');
	}
	;

quoted_char
	= substitution
	/ escape_sequence
	/ argument_chars
	/ WS
	;

argument_chars
	= $([^\r\n`{\t \\#]+)
	;

escape_sequence
	= '\\' ('u' HEX HEX HEX HEX / 'x' HEX HEX / [a-z0{}`\\])
	{
		return backslash(text());
	}
	;

substitution
	= '{' /* TODO conditional */ optional:(WS? '?')? WS? expr:expression WS? '}'
	{
		if (expr.value === null || expr.value === undefined) {
			if (optional) {
				return undefined;
			}

			error(`unknown variable: ${expr.name}`);
		}

		return expr.value;
	}
	;

expression
	= substitution
	/ variable_reference
	;

variable_reference
	= name:identifier
	{
		return namespace[name] || {name};
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
