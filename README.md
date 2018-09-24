<h1 align="center">
	<br>
	<img width="250" src="asset/logo.png" alt="Tag">
	<br>
</h1>

> **STATUS:** Tag is in initial development. Don't use it yet - you won't have a fun time when things change.

**Tag** is a task runner/build script generator that employs a _very_ basic
DSL in order to specify job dependencies with potentially complex
build configurations (variants).

Tag is most similar to GNU Make, and consists of just a few primitives:

- **Rules** - map inputs to targets (outputs)
- **Tasks** - pseudo-commands to build a pre-determined set of targets (similar to `.PHONY` rules in GNU Make)
- **Commands** - run via the shell on the host system (e.g. `/bin/bash` on unix, `cmd.exe` on windows, and so on)
- **Tags** - boolean flags that enable or disable rules/commands/tasks (hence the project name)

## Installation

Install Tag by running **one** of the following commands:

```console
$ yarn global add tag-cli
$ npm i -g tag-cli
```

# License

Tag is Copyright &copy; 2018 by Josh Junon. Released under the [MIT License](LICENSE).
