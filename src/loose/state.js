import {tokenizer, SourceLocation, tokTypes as tt, Node, lineBreak, isNewLine} from ".."

export class LooseParser{
  constructor(input, options) {
    this.toks = tokenizer(input, options)
    this.options = this.toks.options
    this.input = this.toks.input
    this.tok = this.last = {type: tt.eof, start: 0, end: 0}
    if (this.options.locations) {
      let here = this.toks.curPosition()
      this.tok.loc = new SourceLocation(this.toks, here, here)
    }
    this.ahead = []; // Tokens ahead
    this.context = []; // Indentation contexted
    this.curIndent = 0
    this.curLineStart = 0
    this.nextLineStart = this.lineEnd(this.curLineStart) + 1
  }

  startNode() {
    return new Node(this.toks, this.tok.start, this.options.locations ? this.tok.loc.start : null)
  }

  storeCurrentPos() {
    return this.options.locations ? [this.tok.start, this.tok.loc.start] : this.tok.start
  }

  startNodeAt(pos) {
    if (this.options.locations) {
      return new Node(this.toks, pos[0], pos[1])
    } else {
      return new Node(this.toks, pos)
    }
  }

  finishNode(node, type) {
    node.type = type
    node.end = this.last.end
    if (this.options.locations)
      node.loc.end = this.last.loc.end
    if (this.options.ranges)
      node.range[1] = this.last.end
    return node
  }

  dummyIdent() {
    let dummy = this.startNode()
    dummy.name = "✖"
    return this.finishNode(dummy, "Identifier")
  }

  eat(type) {
    if (this.tok.type === type) {
      this.next()
      return true
    } else {
      return false
    }
  }

  isContextual(name) {
    return this.tok.type === tt.name && this.tok.value === name
  }

  eatContextual(name) {
    return this.tok.value === name && this.eat(tt.name)
  }

  canInsertSemicolon() {
    return this.tok.type === tt.eof || this.tok.type === tt.braceR ||
      lineBreak.test(this.input.slice(this.last.end, this.tok.start))
  }

  semicolon() {
    return this.eat(tt.semi)
  }

  expect(type) {
    if (this.eat(type)) return true
    for (let i = 1; i <= 2; i++) {
      if (this.lookAhead(i).type == type) {
        for (let j = 0; j < i; j++) this.next()
        return true
      }
    }
  }

  pushCx() {
    this.context.push(this.curIndent)
  }

  popCx() {
    this.curIndent = this.context.pop()
  }

  lineEnd(pos) {
    while (pos < this.input.length && !isNewLine(this.input.charCodeAt(pos))) ++pos
    return pos
  }

  indentationAfter(pos) {
    for (let count = 0;; ++pos) {
      let ch = this.input.charCodeAt(pos)
      if (ch === 32) ++count
      else if (ch === 9) count += this.options.tabSize
      else return count
    }
  }

  closes(closeTok, indent, line, blockHeuristic) {
    if (this.tok.type === closeTok || this.tok.type === tt.eof) return true
    return line != this.curLineStart && this.curIndent < indent && this.tokenStartsLine() &&
      (!blockHeuristic || this.nextLineStart >= this.input.length ||
       this.indentationAfter(this.nextLineStart) < indent)
  }

  tokenStartsLine() {
    for (let p = this.tok.start - 1; p >= this.curLineStart; --p) {
      let ch = this.input.charCodeAt(p)
      if (ch !== 9 && ch !== 32) return false
    }
    return true
  }
}
