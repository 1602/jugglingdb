/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Narcissus JavaScript engine.
 *
 * The Initial Developer of the Original Code is
 * Brendan Eich <brendan@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Shu-Yu Guo <shu@rfrn.org>
 *   Bruno Jouhier
 *   Gregor Richards
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

if (typeof exports !== 'undefined') {
	var Narcissus = require('../../deps/narcissus');
}
(function(exports){
	eval(Narcissus.definitions.consts);
	var tokens = Narcissus.definitions.tokens;
	
	exports.format = function(node, linesOpt) {
		var result = '';
	
		var ppOut = _pp(node);
		if (linesOpt == "ignore")
			return ppOut.source;
		
		var lineMap = ppOut.lineMap;
		
		var lines = ppOut.source.split("\n");
		
		if (linesOpt == "preserve") {
			var outputLineNo = 1;
			for (var i = 0; i < lines.length; i++) {
				var sourceNodes = (lineMap[i] || []).filter(function(n) { return n._isSourceNode });
				if (sourceNodes.length > 0) {
					var sourceLineNo = sourceNodes[0].lineno;
					while (outputLineNo < sourceLineNo) {
						result += "\n";
						outputLineNo += 1;
					}
				}
				result += lines[i].replace(/^\s+/, ' ');
			}
		}
		else if (linesOpt == "mark"){
			for (var i = 0; i < lines.length; i++) {
				var line = lines[i];
				var sourceNodes = (lineMap[i] || []).filter(function(n) { return n._isSourceNode });
				var linePrefix = '            ';
				if (sourceNodes.length > 0) {
					var sourceLineNo = '' + sourceNodes[0].lineno;
					linePrefix = '/* ';
					for (var j = sourceLineNo.length; j < 5; j++) linePrefix += ' ';
					linePrefix += sourceLineNo + ' */ ';
				}
				result += linePrefix + line + "\n";
			}
		}
		else
			throw new Error("bad --lines option: " + linesOpt)
		
		return result;
	}
	
	/** Narcissus.decompiler.pp with line number tracking **/
	function _pp(node) {
		
		var curLineNo = 0;
		var lineNodeMap = {};
		
		var src = pp(node);
		
		return {
			source: src,
			lineMap: lineNodeMap
		};
		
		function countNewline(s) {
			curLineNo += 1;
			return s;
		}
		
		function indent(n, s) {
			var ss = "", d = true;
	
			for (var i = 0, j = s.length; i < j; i++) {
				if (d)
					for (var k = 0; k < n; k++)
						ss += " ";
				ss += s[i];
				d = s[i] === '\n';
			}
	
			return ss;
		}
	
		function isBlock(n) {
			return n && (n.type === BLOCK);
		}
	
		function isNonEmptyBlock(n) {
			return isBlock(n) && n.children.length > 0;
		}
	
		function nodeStr(n) {
			return '"' +
				n.value.replace(/\\/g, "\\\\")
				       .replace(/"/g, "\\\"")
				       .replace(/\n/g, "\\n")
				       .replace(/\r/g, "\\r") +
				       '"';
		}
	
		function pp(n, d, inLetHead) {
			var topScript = false;
	
			if (!n)
				return "";
			if (!(n instanceof Object))
				return n;
			if (!d) {
				topScript = true;
				d = 1;
			}
			
			if (!lineNodeMap[curLineNo])
				lineNodeMap[curLineNo] = [];
			
			lineNodeMap[curLineNo].push(n);
	
			var p = "";
	
			if (n.parenthesized)
				p += "(";
	
			switch (n.type) {
			case FUNCTION:
			case GETTER:
			case SETTER:
				if (n.type === FUNCTION)
					p += "function";
				else if (n.type === GETTER)
					p += "get";
				else
					p += "set";
	
				p += (n.name ? " " + n.name : "") + "(";
				for (var i = 0, j = n.params.length; i < j; i++)
					p += (i > 0 ? ", " : "") + pp(n.params[i], d);
				p += ") " + pp(n.body, d);
				break;
	
			case SCRIPT:
			case BLOCK:
				var nc = n.children;
				if (topScript) {
					// No indentation.
					for (var i = 0, j = nc.length; i < j; i++) {
						if (i > 0) 
							p += countNewline("\n");
						p += pp(nc[i], d);
						var eoc = p[p.length - 1];
						if (eoc != ";")
							p += ";";
					}
	
					break;
				}
	
				p += "{";
				if (n.id !== undefined)
					p += " /* " + n.id + " */";
				p += countNewline("\n");
				for (var i = 0, j = nc.length; i < j; i++) {
					if (i > 0)
						p += countNewline("\n");
					p += indent(2, pp(nc[i], d));
					var eoc = p[p.length - 1];
					if (eoc != ";")
						p += ";";
				}
				p += countNewline("\n}");
				break;
	
			case LET_BLOCK:
				p += "let (" + pp(n.variables, d, true) + ") ";
				if (n.expression)
					p += pp(n.expression, d);
				else
					p += pp(n.block, d);
				break;
	
			case IF:
				p += "if (" + pp(n.condition, d) + ") ";
	
				var tp = n.thenPart, ep = n.elsePart;
				var b = isBlock(tp) || isBlock(ep);
				if (!b)
					p += countNewline("{\n");
				p += (b ? pp(tp, d) : indent(2, pp(tp, d)))
				if (ep && ";}".indexOf(p[p.length - 1]) < 0)
					p += ";";
				p += countNewline("\n");
	
				if (ep) {
					if (!b)
						p += countNewline("} else {\n");
					else
						p += " else ";
	
					p += (b ? pp(ep, d) : indent(2, pp(ep, d))) + countNewline("\n");
				}
				if (!b)
					p += "}";
				break;
	
			case SWITCH:
				p += "switch (" + pp(n.discriminant, d) + countNewline(") {\n");
				for (var i = 0, j = n.cases.length; i < j; i++) {
					var ca = n.cases[i];
					if (ca.type === CASE)
						p += "case " + pp(ca.caseLabel, d) + countNewline(":\n");
					else
						p += countNewline("  default:\n");
					ps = pp(ca.statements, d);
					p += ps.slice(2, ps.length - 2) + countNewline("\n");
				}
				p += "}";
				break;
	
			case FOR:
				p += "for (" + pp(n.setup, d) + "; "
							 + pp(n.condition, d) + "; "
							 + pp(n.update, d) + ") ";
	
				var pb = pp(n.body, d);
				if (!isBlock(n.body))
					p += countNewline("{\n") + indent(2, pb) + countNewline(";\n}");
				else if (n.body)
					p += pb;
				break;
	
			case WHILE:
				p += "while (" + pp(n.condition, d) + ") ";
	
				var pb = pp(n.body, d);
				if (!isBlock(n.body))
					p += countNewline("{\n") + indent(2, pb) + countNewline(";\n}");
				else
					p += pb;
				break;
	
			case FOR_IN:
				var u = n.varDecl;
				p += n.isEach ? "for each (" : "for (";
				p += (u ? pp(u, d) : pp(n.iterator, d)) + " in " +
					 pp(n.object, d) + ") ";
	
				var pb = pp(n.body, d);
				if (!isBlock(n.body))
					p += countNewline("{\n") + indent(2, pb) + countNewline(";\n}");
				else if (n.body)
					p += pb;
				break;
	
			case DO:
				p += "do " + pp(n.body, d);
				p += " while (" + pp(n.condition, d) + ");";
				break;
	
			case BREAK:
				p += "break" + (n.label ? " " + n.label : "") + ";";
				break;
	
			case CONTINUE:
				p += "continue" + (n.label ? " " + n.label : "") + ";";
				break;
	
			case TRY:
				p += "try ";
				p += pp(n.tryBlock, d);
				for (var i = 0, j = n.catchClauses.length; i < j; i++) {
					var t = n.catchClauses[i];
					p += " catch (" + pp(t.varName, d) +
									(t.guard ? " if " + pp(t.guard, d) : "") +
									") ";
					p += pp(t.block, d);
				}
				if (n.finallyBlock) {
					p += " finally ";
					p += pp(n.finallyBlock, d);
				}
				break;
	
			case THROW:
				p += "throw " + pp(n.exception, d);
				break;
	
			case RETURN:
				p += "return";
				if (n.value)
					p += " " + pp(n.value, d);
				break;
	
			case YIELD:
				p += "yield";
				if (n.value.type)
					p += " " + pp(n.value, d);
				break;
	
			case GENERATOR:
				p += pp(n.expression, d) + " " + pp(n.tail, d);
				break;
	
			case WITH:
				p += "with (" + pp(n.object, d) + ") ";
				p += pp(n.body, d);
				break;
	
			case LET:
			case VAR:
			case CONST:
				var nc = n.children;
				if (!inLetHead) {
					p += tokens[n.type] + " ";
				}
				for (var i = 0, j = nc.length; i < j; i++) {
					if (i > 0)
						p += ", ";
					var u = nc[i];
					p += pp(u.name, d);
					if (u.initializer)
						p += " = " + pp(u.initializer, d);
				}
				break;
	
			case DEBUGGER:
				p += countNewline("debugger NYI\n");
				break;
	
			case SEMICOLON:
				if (n.expression) {
					p += pp(n.expression, d) + ";";
				}
				break;
	
			case LABEL:
				p += n.label + countNewline(":\n") + pp(n.statement, d);
				break;
	
			case COMMA:
			case LIST:
				var nc = n.children;
				for (var i = 0, j = nc.length; i < j; i++) {
					if (i > 0)
						p += ", ";
					p += pp(nc[i], d);
				}
				break;
	
			case ASSIGN:
				var nc = n.children;
				var t = n.assignOp;
				p += pp(nc[0], d) + " " + (t ? tokens[t] : "") + "=" + " " + pp(nc[1], d);
				break;
	
			case HOOK:
				var nc = n.children;
				p += "(" + pp(nc[0], d) + " ? "
						 + pp(nc[1], d) + " : "
						 + pp(nc[2], d);
				p += ")";
				break;
	
			case OR:
			case AND:
				var nc = n.children;
				p += "(" + pp(nc[0], d) + " " + tokens[n.type] + " "
						 + pp(nc[1], d);
				p += ")";
				break;
	
			case BITWISE_OR:
			case BITWISE_XOR:
			case BITWISE_AND:
			case EQ:
			case NE:
			case STRICT_EQ:
			case STRICT_NE:
			case LT:
			case LE:
			case GE:
			case GT:
			case IN:
			case INSTANCEOF:
			case LSH:
			case RSH:
			case URSH:
			case PLUS:
			case MINUS:
			case MUL:
			case DIV:
			case MOD:
				var nc = n.children;
				p += "(" + pp(nc[0], d) + " " + tokens[n.type] + " "
						 + pp(nc[1], d) + ")";
				break;
	
			case DELETE:
			case VOID:
			case TYPEOF:
				p += tokens[n.type] + " " + pp(n.children[0], d);
				break;
	
			case NOT:
			case BITWISE_NOT:
				p += tokens[n.type] + pp(n.children[0], d);
				break;
	
			case UNARY_PLUS:
				p += "+" + pp(n.children[0], d);
				break;
	
			case UNARY_MINUS:
				p += "-" + pp(n.children[0], d);
				break;
	
			case INCREMENT:
			case DECREMENT:
				if (n.postfix) {
					p += pp(n.children[0], d) + tokens[n.type];
				} else {
					p += tokens[n.type] + pp(n.children[0], d);
				}
				break;
	
			case DOT:
				var nc = n.children;
				p += pp(nc[0], d) + "." + pp(nc[1], d);
				break;
	
			case INDEX:
				var nc = n.children;
				p += pp(nc[0], d) + "[" + pp(nc[1], d) + "]";
				break;
	
			case CALL:
				var nc = n.children;
				p += pp(nc[0], d) + "(" + pp(nc[1], d) + ")";
				break;
	
			case NEW:
			case NEW_WITH_ARGS:
				var nc = n.children;
				p += "new " + pp(nc[0], d);
				if (nc[1])
					p += "(" + pp(nc[1], d) + ")";
				break;
	
			case ARRAY_INIT:
				p += "[";
				var nc = n.children;
				for (var i = 0, j = nc.length; i < j; i++) {
					if(nc[i])
						p += pp(nc[i], d);
					p += ","
				}
				p += "]";
				break;
	
			case ARRAY_COMP:
				p += "[" + pp (n.expression, d) + " ";
				p += pp(n.tail, d);
				p += "]";
				break;
	
			case COMP_TAIL:
				var nc = n.children;
				for (var i = 0, j = nc.length; i < j; i++) {
					if (i > 0)
						p += " ";
					p += pp(nc[i], d);
				}
				if (n.guard)
					p += " if (" + pp(n.guard, d) + ")";
				break;
	
			case OBJECT_INIT:
				var nc = n.children;
				if (nc[0] && nc[0].type === PROPERTY_INIT)
					p += countNewline("{\n");
				else
					p += "{";
				for (var i = 0, j = nc.length; i < j; i++) {
					if (i > 0) {
						p += countNewline(",\n");
					}
	
					var t = nc[i];
					if (t.type === PROPERTY_INIT) {
						var tc = t.children;
						var l;
						// see if the left needs to be a string
						if (tc[0].value === "" || /[^A-Za-z0-9_$]/.test(tc[0].value)) {
							l = nodeStr(tc[0]);
						} else {
							l = pp(tc[0], d);
						}
						p += indent(2, l) + ": " +
							 indent(2, pp(tc[1], d)).substring(2);
					} else {
						p += indent(2, pp(t, d));
					}
				}
				p += countNewline("\n}");
				break;
	
			case NULL:
				p += "null";
				break;
	
			case THIS:
				p += "this";
				break;
	
			case TRUE:
				p += "true";
				break;
	
			case FALSE:
				p += "false";
				break;
	
			case IDENTIFIER:
			case NUMBER:
			case REGEXP:
				p += n.value;
				break;
	
			case STRING:
				p += nodeStr(n);
				break;
	
			case GROUP:
				p += "(" + pp(n.children[0], d) + ")";
				break;
	
			default:
				throw "PANIC: unknown operation " + tokens[n.type] + " " + n.toSource();
			}
	
			if (n.parenthesized)
				p += ")";
	
			return p;
		}
	}
})(typeof exports !== 'undefined' ? exports : (window.Streamline = window.Streamline || {}));
