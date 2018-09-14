{
	const {namespace, echoFn} = options;
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
	= cmd:$([A-Z]+) args:(WS l:argument_list {return l;})?
	{
		return {cmd, args};
	}
	;

argument_list "argument list"
	= f:argument r:(ws:WS a:argument {return [ws, a];})*
	{
		const args = [f];
		const all_args = [f];
		for (const rest of r) {
			args.push(rest[1]);
			all_args.push(rest[0], rest[1]);
		}
		return {args, text: all_args.join('')};
	}
	;

argument "argument"
	= quoted_argument
	/ single_argument
	;

single_argument
	= $([^\t \r\n]+)
	;

quoted_argument
	= '`' text:$([^`\r\n]+) '`'
	{
		return text;
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
	= positive:[@!] path:path
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

path
	= $(identifier (':' identifier)*)
	;

identifier "identifier"
	= $([a-z_+]i [a-z0-9_+]*)
	;

comment "comment"
	= '#' [^\r\n]

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
