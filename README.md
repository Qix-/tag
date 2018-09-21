![Tag Logo](asset/logo.png)

# Tag

**Tag** is a task runner/build script generator that employs a _very_ basic
DSL in order to specify job dependencies with potentially complex
build configurations (variants).

Tag is most similar to GNU Make, and consists of just a few primitives:

- **Rules** - map inputs to targets (outputs)
- **Tasks** - pseudo-commands to build a pre-determined set of targets (similar to `.PHONY` rules in GNU Make)
- **Commands** - run via the shell on the host system (e.g. `/bin/bash` on unix, `cmd.exe` on windows, and so on)
- **Tags** - boolean flags that enable or disable rules/commands/tasks (hence the project name)

... just a few philosophies ...

- **Build contexts** - similar to Docker contexts, Tag forces out-of-source builds by using a root directory as
  a "context" for which files can be referenced. This allows Tag to run builds in a variety of ways.
- **Strict variables** - unlike other build tools, Tag enforces the presence of variables when they're used.
  This is similar to `set -u` in shell script.
- **Unopinionated** - Tag doesn't make any assumptions about what you're trying to run. It simply runs it
  in various ways. Use tag as a build system, tag runner, scripting language, etc.

## Installation

Install Tag by running **one** of the following commands:

```console
$ yarn global add tag
$ npm i -g tag
```

## Usage

```console
$ tag --help

 tag - yet another task runner

 $ tag -v [task ...] [@tag ...] [NAME=[value] ...]
 $ tag --help

 OPTIONS
   --help                    shows this help message
   --version, -V             shows the version string
   --verbose, -v             verbose output

   --tagfile, -F filename    the filename to read as the Tagfile
                             (defaults to './Tagfile')

   @tag_name                 enables a tag by name
                             (can be specified multiple times)

   NAME=[value]              sets a variable
                             (can be specified multiple times)
```

For example, to run Tag using the working directory's `Tagfile` with the `all` task (the default), simply run

```console
$ tag
```

To enable the `foo` tag:

```console
$ tag @foo
```

To set the variable `FOO` to `Bar`:

```console
$ tag FOO=Bar
```

To run `clean` and then `all` (a full rebuild):

```console
$ tag clean all
```

And finally, you may combine all of these together:

```console
$ tag clean all @foo @bar SOME_VAR='Some value'
```

## Why?

Because writing cross-platform scripts with various configurations is annoying. Further,
I needed a jumping off point for a tool that can run various scripts on multiple platforms/environments,
with the ability to create specific edge-case variants of commands in very specific situations.

## Non-goals

There are some things Tag doesn't care _too_ much about:

- **Configuration speed** - reconfiguration doesn't happen often (at least, not as often as builds), so Tag
  takes the liberty to perform some potentially hefty filesystem operations in order to add a few more
  features while keeping this a bit more deterministic and 'correct'.
- **Build system primitives** - Tag won't come bundled with any `add_shared_c++_library()`-type functions.
  It aims to be more like GNU Make and less like CMake.

## Basics

```tag
# This is a comment. They can appear anywhere (even alongside Tag code),
# starting with a `#' and continuing until a newline (`\n').

# Set variable values by using the `SET' builtin.
# Values are consumed until the end of the line.
# Quotes have no special meaning and are considered literals.
#
# Although not strictly enforced by Tag, it is convention
# to name variables with ALL_CAPS to differentiate between variables
# and tags.
#
# Note that once an identifier has been used in a tag or a variable,
# it cannot be re-used as another type (Tag will error). This is another
# reason for the above convention.
SET FOO=bar

# You can reference variables anywhere in Tag code by
# wrapping the variable in curly braces (`{}')
SET FOO={FOO} bar2  # FOO now equates to "bar bar2"

# Use tag's built-in preset called "os", which
# provides the @win32, @macos, @linux, etc. tags.
USE os

# `TAGPATH' is used to resolve the argument to `USE'.
#
# Note that its path separator is always a colon (`:'),
# regardless of `PATHSEP'.
#
# Here is the default `TAGPATH' value.
#
# By default, all environment variables are included as variables.
SET TAGPATH=./%.tag:./node_modules/tag-preset-%/index.tag:./node_modules/%/index.tag

# `PATHSEP` is used to delimit multi-element strings in variables.
# If you `USE os', `PATHSEP' is set for you.
#
# (If you're curious about the `@' and `!', keep reading.)
@win32 SET PATHSEP=;
!win32 SET PATHSEP=:

# Tags are boolean (1 or 0) values that can be turned on or off.
# Turning on/off a tag that is already respectively enabled/disabled
# has no effect.
#
# As a convention (though not enforced), tags should be lower case
# in order to differentiate between tags and variables.
ON foo
OFF foo

# Tags can then be used to enable/disable statements. Yes, any statement.
@foo ECHO Foo is enabled!
!foo ECHO Foo is disabled!

# The `ECHO' builtin prints out information about whatever is running.
ECHO Hello from Tag!
@win32 ECHO You're running on Windows.
!win32 ECHO You're not running on Windows.

# Remember the variable substitution syntax above (`{VAR}')? It's more than
# just substitution.
#
# By prefixing substitutions, you can conditionally ignore/include the
# whole substitution.
ECHO You are {!win32 NOT }running on windows.

# Note that an empty substitution emits nothing.
ECHO {} # echoes nothing.

# If a variable is used in place of a tag prefix, the "boolean" is whether or
# not the variable exists.
@SOMETHING echo Something is {SOMETHING}  # not echoed.
SET SOMETHING=Hello
@SOMETHING echo Something is {SOMETHING}  # echoes

# This can, of course, be used in a substitution as well.
ECHO C flags that are set: {@CFLAGS {CFLAGS}}

# Substitutions have a little syntactic sugar to help in the cases
# where a variable doesn't _have_ to exist via the use of the question
# mark (`?') operator.
#
# It's worth mentioning that the question mark operator is available ONLY
# inside of substitutions - nowhere else.
#
# The following two lines are semantically identical.
ECHO Foobar is: {@FOOBAR {FOOBAR}}
ECHO Foobar is: {?FOOBAR}

# This means Tag is strict about unknown variables and will error if
# it encounters a variable that has not been seen before if used
# in a substitution.
#
# Assuming the variable `FIZZBUZZ' does not exist, the following line
# will cause Tag to fatally exit with an error.
ECHO {FIZZBUZZ}   # causes fatal error (FIZZBUZZ is not a tag or a variable)
ECHO {?FIZZBUZZ}  # echoes an empty line

# TODO `RUN'
# TODO `CALL'
# TODO `IN'
# TODO `DEF`
# TODO `TASK`
# TODO `MAIN`
```

As a bonus, here's some ~~absurd~~ advanced stuff you can do with the Tag language.

```
# Double substitution works like you'd expect.
SET FOO=BAR
SET BAR=baz
ECHO {{FOO}} # echos "baz"

# If, for whatever reason, you want to localize something, this is one
# way you could do it.
SET LANG=en_US
ON foo

ON {LANG}
@en_US SET ON_TXT=is enabled
@en_US SET OFF_TXT=is disabled
@de_DE SET ON_TXT=ist aktiviert
@de_DE SET OFF_TXT=ist nicht aktiviert

ECHO foo {{@foo ON_TXT}{!foo OFF_TXT}}

# Some alternative ways to write the above line:
ECHO foo {@foo {ON_TXT}}{!foo {OFF_TXT}}
ECHO foo {{@foo ON}{!foo OFF}_TXT}
@foo ECHO foo {ON_TXT}
!foo ECHO foo {OFF_TXT}

# Force Tag to exit with a fatal error if a tag is enabled
# (though this is a strange and not-so-recommended way of doing this)
@throw_if_on SET _={DOESNOTEXIST}  # assumes `DOESNOTEXIST' really doesn't exist ;)
```

## Built-in Tasks

Tag currently provides one built-in task: `all`. Note that built-in tasks _can_ be overridden.

The `all` task evaluates all rules and builds up a graph of all applicable files, building each one.
While this is probably suitable for small projects, larger projects will want to override the
entry point using the `MAIN` keyword.

## Examples

C/C++ compilation

```tag
# specify @fast for fast code
# specify @small for small code
# specify @debug for debug symbols to be generated

USE os # @win32, @linux, @macos, etc.

@win32 !mingw SET OBJ=obj
!OBJ SET OBJ=o

OFF lang_c
OFF lang_c++
OFF linker
IN PATH gcc on lang_c linker gcc
IN PATH g++ on lang_c++ linker g++
IN PATH clang on lang_c linker clang
IN PATH clang++ on lang_c++ linker clang++
IN PATH ld on linker ld
@win32 IN PATH cl.exe on lang_c lang_c++ msvc
@win32 IN PATH link.exe on msvc linker

!lang_c ERROR no C toolchain was detected
!lang_c++ ERROR no C++ toolchain was detected
!linker ERROR no linker was detected

@lang_c++ DEF bin/$1.{OBJ} : src/(.+)\.c(c|pp)
	@msvc RUN cl.exe /c /OUT:{OUT} {IN} {@fast /O2 /Ox} {@small /O1 /Ox} {@debug /Od}
	# TODO @clang
	# TODO @gcc

@lang_c DEF bin/$1.{OBJ} : src/(.+)\.c
	@msvc RUN cl.exe /c /OUT:{OUT} {IN} {@fast /O2 /Ox} {@small /O1 /Ox} {@debug /Od}
	# TODO @clang
	# TODO @gcc

@linker DEF bin/$1 {@msvc @debug OUT_PDB=bin/$1.pdb} : bin/(.+)\.{OBJ}
	@msvc RUN link.exe {@debug /DEBUG /PDB:{OUT_PDB} /OUT:{OUT}} {IN}
	# TODO @clang
	# TODO @gcc
```
