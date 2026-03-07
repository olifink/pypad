import { Injectable } from '@angular/core';
import { syntaxTree } from '@codemirror/language';
import { EditorView } from 'codemirror';
import type { SyntaxNode } from '@lezer/common';

const ALLOWED_NODES = new Set(['VariableName', 'PropertyName', 'Attribute', 'FunctionName']);

/**
 * Lezer/python represents keyword tokens as leaf nodes whose type name IS the keyword text
 * (e.g. node type "for", "def"). Boolean literals use type "Boolean"; None uses type "None".
 */
const KEYWORD_NODE_TYPES = new Set([
  'if', 'elif', 'else',
  'for', 'while', 'break', 'continue', 'pass', 'return',
  'def', 'class', 'lambda',
  'try', 'except', 'finally', 'raise', 'with', 'as',
  'import', 'from',
  'global', 'nonlocal',
  'and', 'or', 'not', 'in', 'is', 'del',
  'async', 'await', 'yield',
  'assert', 'match', 'case', 'type',
  // Literal value nodes
  'Boolean', 'None',
]);

@Injectable({ providedIn: 'root' })
export class EditorContextService {
  getSymbolAt(view: EditorView, pos: number): string | null {
    const { state } = view;
    const tree = syntaxTree(state);
    const node = tree.resolveInner(pos, -1);

    // Keyword nodes are atomic leaf nodes — return their text directly.
    if (KEYWORD_NODE_TYPES.has(node.type.name)) {
      return state.sliceDoc(node.from, node.to);
    }

    if (!ALLOWED_NODES.has(node.type.name)) return null;

    // Walk up through MemberExpression ancestors to find the full chain start.
    let chainStart: SyntaxNode = node;
    let current = node.parent;
    while (current?.type.name === 'MemberExpression') {
      chainStart = current;
      current = current.parent;
    }

    return state.sliceDoc(chainStart.from, node.to);
  }
}
