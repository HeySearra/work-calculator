import { useEffect, useRef, useState, type CSSProperties } from 'react'

// 安全表达式求值：支持 + - * / ( ) 与小数、负号。非法 / 不完整返回 null。
// 不使用 eval，手写词法 + 递归下降解析，避免任意代码执行。
type Tok = { k: 'n'; v: number } | { k: 'o'; o: string } | { k: 'p'; p: string }

export function evalExpr(src: string): number | null {
  const s = src.replace(/\s+/g, '')
  if (!s) return null
  const tokens: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i
      let dots = 0
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) {
        if (s[j] === '.') dots++
        j++
      }
      if (dots > 1) return null
      const n = Number(s.slice(i, j))
      if (!isFinite(n)) return null
      tokens.push({ k: 'n', v: n })
      i = j
    } else if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ k: 'o', o: c })
      i++
    } else if (c === '(' || c === ')') {
      tokens.push({ k: 'p', p: c })
      i++
    } else {
      return null
    }
  }

  let pos = 0
  const peek = () => tokens[pos]
  const expr = (): number | null => {
    let left = term()
    if (left === null) return null
    while (peek() && peek()!.k === 'o' && ((peek() as { o: string }).o === '+' || (peek() as { o: string }).o === '-')) {
      const op = (peek() as { o: string }).o
      pos++
      const right = term()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }
  const term = (): number | null => {
    let left = factor()
    if (left === null) return null
    while (peek() && peek()!.k === 'o' && ((peek() as { o: string }).o === '*' || (peek() as { o: string }).o === '/')) {
      const op = (peek() as { o: string }).o
      pos++
      const right = factor()
      if (right === null) return null
      if (op === '*') left *= right
      else {
        if (right === 0) return null
        left /= right
      }
    }
    return left
  }
  const factor = (): number | null => {
    const t = peek()
    if (!t) return null
    if (t.k === 'o' && t.o === '-') {
      pos++
      const v = factor()
      return v === null ? null : -v
    }
    if (t.k === 'o' && t.o === '+') {
      pos++
      return factor()
    }
    if (t.k === 'p' && t.p === '(') {
      pos++
      const v = expr()
      if (v === null) return null
      const close = peek()
      if (!close || close.k !== 'p' || (close as { p: string }).p !== ')') return null
      pos++
      return v
    }
    if (t.k === 'n') {
      pos++
      return t.v
    }
    return null
  }

  const r = expr()
  if (r === null || pos !== tokens.length) return null
  return Math.round(r * 1e6) / 1e6 // 规避浮点误差，如 0.1+0.2
}

interface CalcInputProps {
  value: number | string | undefined
  onCommit: (n: number) => void
  onEmpty?: () => void
  display?: (n: number) => string
  className?: string
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
  style?: CSSProperties
}

// 金额 / 数值输入框：可直接输入算式（如 1+1），回车或失焦后自动求值得数字。
// 普通数字也可正常输入；非法算式保留原文本等待修正。
export function CalcInput({
  value,
  onCommit,
  onEmpty,
  display,
  className,
  placeholder,
  inputMode = 'decimal',
  style,
}: CalcInputProps) {
  const [text, setText] = useState('')
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) {
      const n = typeof value === 'number' ? value : parseFloat(value as string)
      setText(n != null && !isNaN(n) ? (display ? String(display(n)) : String(n)) : '')
    }
    // 仅在外部 value 变化时同步；编辑中的文本不被覆盖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit() {
    const t = text.trim()
    if (t === '') {
      if (onEmpty) onEmpty()
      else onCommit(0)
      setText('')
      return
    }
    const r = evalExpr(t)
    if (r !== null && isFinite(r)) {
      onCommit(r)
      setText(display ? String(display(r)) : String(r))
    }
    // 非法 / 不完整算式：保留文本，等待用户修正
  }

  return (
    <input
      type="text"
      inputMode={inputMode}
      className={className}
      placeholder={placeholder}
      style={style}
      value={text}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
