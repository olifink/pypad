import type { DocEntry } from './docs.service';

const REF = 'https://docs.python.org/3/reference';
const EXPR = `${REF}/expressions.html`;
const SIMPLE = `${REF}/simple_stmts.html`;
const COMPOUND = `${REF}/compound_stmts.html`;
const IMPORT = `${REF}/import.html`;

export const KEYWORD_DOCS: Record<string, DocEntry> = {
  // --- Definition keywords ---
  def: {
    signature: 'def <name>(<params>): ...',
    description: 'Defines a new function (or method) with the given name and parameters.',
    url: `${COMPOUND}#function-definitions`,
  },
  class: {
    signature: 'class <Name>(<bases>): ...',
    description: 'Defines a new class, optionally inheriting from one or more base classes.',
    url: `${COMPOUND}#class-definitions`,
  },
  lambda: {
    signature: 'lambda <params>: <expression>',
    description: 'Creates an anonymous function that evaluates and returns a single expression.',
    url: `${EXPR}#lambda`,
  },

  // --- Control flow ---
  if: {
    signature: 'if <condition>: ...',
    description: 'Executes the indented block only when the condition evaluates to True.',
    url: `${COMPOUND}#the-if-statement`,
  },
  elif: {
    signature: 'elif <condition>: ...',
    description: 'Adds an alternative condition branch to an if statement.',
    url: `${COMPOUND}#the-if-statement`,
  },
  else: {
    signature: 'else: ...',
    description:
      'Executes its block when no preceding if/elif condition matched, or after a loop completes normally.',
    url: `${COMPOUND}#the-if-statement`,
  },
  for: {
    signature: 'for <var> in <iterable>: ...',
    description: 'Iterates over each item in an iterable, binding it to the loop variable.',
    url: `${COMPOUND}#the-for-statement`,
  },
  while: {
    signature: 'while <condition>: ...',
    description: 'Repeats its block as long as the condition remains True.',
    url: `${COMPOUND}#the-while-statement`,
  },
  break: {
    signature: 'break',
    description: 'Exits the nearest enclosing for or while loop immediately.',
    url: `${SIMPLE}#the-break-statement`,
  },
  continue: {
    signature: 'continue',
    description: 'Skips the rest of the current loop iteration and jumps to the next one.',
    url: `${SIMPLE}#the-continue-statement`,
  },
  pass: {
    signature: 'pass',
    description: 'A no-op placeholder used where a statement is syntactically required but nothing should happen.',
    url: `${SIMPLE}#the-pass-statement`,
  },
  return: {
    signature: 'return [<value>]',
    description: 'Exits the current function, optionally returning a value to the caller.',
    url: `${SIMPLE}#the-return-statement`,
  },

  // --- Exception handling ---
  try: {
    signature: 'try: ...',
    description: 'Marks a block of code whose exceptions will be caught by except clauses.',
    url: `${COMPOUND}#the-try-statement`,
  },
  except: {
    signature: 'except [<ExceptionType> [as <var>]]: ...',
    description: 'Catches exceptions of the specified type raised inside a try block.',
    url: `${COMPOUND}#the-try-statement`,
  },
  finally: {
    signature: 'finally: ...',
    description: 'Defines a cleanup block that always executes after a try/except, regardless of whether an exception occurred.',
    url: `${COMPOUND}#the-try-statement`,
  },
  raise: {
    signature: 'raise [<exception>]',
    description: 'Raises an exception; with no argument it re-raises the current exception.',
    url: `${SIMPLE}#the-raise-statement`,
  },
  with: {
    signature: 'with <expr> [as <var>]: ...',
    description: 'Wraps a block with context manager enter/exit calls, ensuring cleanup even on error.',
    url: `${COMPOUND}#the-with-statement`,
  },
  as: {
    signature: 'with <expr> as <var>: ...',
    description: 'Binds the result of a with expression or an except clause to a local variable.',
    url: `${COMPOUND}#the-with-statement`,
  },

  // --- Import ---
  import: {
    signature: 'import <module>',
    description: 'Loads a module and binds it to a name in the current namespace.',
    url: `${SIMPLE}#the-import-statement`,
  },
  from: {
    signature: 'from <module> import <name>',
    description: 'Imports specific names from a module directly into the current namespace.',
    url: `${SIMPLE}#the-import-statement`,
  },

  // --- Scope ---
  global: {
    signature: 'global <name>',
    description: "Declares that a variable refers to the module's global scope, not the local function scope.",
    url: `${SIMPLE}#the-global-statement`,
  },
  nonlocal: {
    signature: 'nonlocal <name>',
    description: 'Declares that a variable refers to an enclosing (but non-global) scope.',
    url: `${SIMPLE}#the-nonlocal-statement`,
  },

  // --- Boolean literals & None ---
  True: {
    signature: 'True',
    description: 'The boolean true value; an instance of bool and a subtype of int with value 1.',
    url: `${EXPR}#atom-identifiers`,
  },
  False: {
    signature: 'False',
    description: 'The boolean false value; an instance of bool and a subtype of int with value 0.',
    url: `${EXPR}#atom-identifiers`,
  },
  None: {
    signature: 'None',
    description: 'The sole value of the NoneType, used to represent the absence of a value.',
    url: `${EXPR}#atom-identifiers`,
  },

  // --- Logical / comparison operators ---
  and: {
    signature: '<x> and <y>',
    description: 'Returns x if x is falsy, otherwise returns y; short-circuits evaluation.',
    url: `${EXPR}#boolean-operations`,
  },
  or: {
    signature: '<x> or <y>',
    description: 'Returns x if x is truthy, otherwise returns y; short-circuits evaluation.',
    url: `${EXPR}#boolean-operations`,
  },
  not: {
    signature: 'not <x>',
    description: 'Returns True if x is falsy, False otherwise.',
    url: `${EXPR}#boolean-operations`,
  },
  in: {
    signature: '<x> in <iterable>',
    description: 'Returns True if x is a member of the iterable or matches a key in a mapping.',
    url: `${EXPR}#membership-test-operations`,
  },
  is: {
    signature: '<x> is <y>',
    description: 'Tests object identity — True only when x and y refer to the same object in memory.',
    url: `${EXPR}#is-not`,
  },
  del: {
    signature: 'del <target>',
    description: 'Unbinds a name or removes an item from a container (list, dict, etc.).',
    url: `${SIMPLE}#the-del-statement`,
  },

  // --- Async / generator ---
  async: {
    signature: 'async def <name>(<params>): ...',
    description: 'Defines a coroutine function whose execution can be paused and resumed with await.',
    url: `${COMPOUND}#coroutines`,
  },
  await: {
    signature: 'await <coroutine>',
    description: 'Suspends the current coroutine and waits for the awaitable to complete.',
    url: `${EXPR}#await-expression`,
  },
  yield: {
    signature: 'yield [<value>]',
    description: 'Pauses the generator function and produces a value to the caller, saving state for resumption.',
    url: `${SIMPLE}#the-yield-statement`,
  },

  // --- Other ---
  assert: {
    signature: 'assert <condition> [, <message>]',
    description: 'Raises AssertionError (with an optional message) if the condition is False.',
    url: `${SIMPLE}#the-assert-statement`,
  },
  match: {
    signature: 'match <subject>: ...',
    description: 'Structural pattern matching — evaluates the subject and runs the first matching case block.',
    url: `${COMPOUND}#the-match-statement`,
  },
  case: {
    signature: 'case <pattern> [if <guard>]: ...',
    description: 'A branch inside a match statement that executes when the pattern matches the subject.',
    url: `${COMPOUND}#the-match-statement`,
  },
  type: {
    signature: 'type <Name> = <TypeAlias>',
    description: 'Defines a type alias (Python 3.12+), making complex type annotations reusable.',
    url: `${COMPOUND}#type-alias-statements`,
  },
};
