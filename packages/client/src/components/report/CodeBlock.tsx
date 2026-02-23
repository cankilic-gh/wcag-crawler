import { useMemo } from 'react';

interface CodeBlockProps {
  code: string;
  variant?: 'neutral' | 'before' | 'after';
  diffLines?: string[]; // Lines to highlight as changed
}

// Tokenize and highlight HTML/code
function tokenizeHtml(code: string): Array<{ type: string; value: string }> {
  const tokens: Array<{ type: string; value: string }> = [];
  let remaining = code;

  while (remaining.length > 0) {
    // Comments
    let match = remaining.match(/^(<!--[\s\S]*?-->)/);
    if (match) {
      tokens.push({ type: 'comment', value: match[1] });
      remaining = remaining.slice(match[1].length);
      continue;
    }

    // Opening/closing tags
    match = remaining.match(/^(<\/?)([\w-]+)/);
    if (match) {
      tokens.push({ type: 'bracket', value: match[1] });
      tokens.push({ type: 'tag', value: match[2] });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Attributes
    match = remaining.match(/^([\w-]+)(=)(".*?"|'.*?')/);
    if (match) {
      tokens.push({ type: 'attr-name', value: match[1] });
      tokens.push({ type: 'punctuation', value: match[2] });
      tokens.push({ type: 'attr-value', value: match[3] });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Standalone attribute (boolean)
    match = remaining.match(/^([\w-]+)(?=[\s>])/);
    if (match && remaining[0] !== '<' && remaining[0] !== '>') {
      tokens.push({ type: 'attr-name', value: match[1] });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Closing bracket
    match = remaining.match(/^(\s*\/?>)/);
    if (match) {
      tokens.push({ type: 'bracket', value: match[1] });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Whitespace
    match = remaining.match(/^(\s+)/);
    if (match) {
      tokens.push({ type: 'whitespace', value: match[1] });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Text content
    match = remaining.match(/^([^<]+)/);
    if (match) {
      tokens.push({ type: 'text', value: match[1] });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Fallback: single character
    tokens.push({ type: 'text', value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}

const TOKEN_COLORS: Record<string, string> = {
  'bracket': 'text-slate-400',
  'tag': 'text-pink-400',
  'attr-name': 'text-purple-400',
  'punctuation': 'text-slate-400',
  'attr-value': 'text-green-400',
  'comment': 'text-slate-500 italic',
  'text': 'text-slate-300',
  'whitespace': '',
};

export function CodeBlock({ code, variant = 'neutral', diffLines = [] }: CodeBlockProps) {
  const lines = useMemo(() => code.split('\n'), [code]);

  const highlightedLines = useMemo(() => {
    return lines.map((line, index) => {
      const tokens = tokenizeHtml(line);
      const isDiffLine = diffLines.some(dl => line.includes(dl));

      return {
        tokens,
        isDiffLine,
        lineNumber: index + 1,
      };
    });
  }, [lines, diffLines]);

  const getLineHighlight = (isDiffLine: boolean) => {
    if (!isDiffLine) return '';
    if (variant === 'before') return 'bg-red-500/20 border-l-2 border-red-500';
    if (variant === 'after') return 'bg-green-500/20 border-l-2 border-green-500';
    return '';
  };

  return (
    <div className="rounded-xl bg-[#1e1e2e] overflow-hidden font-code">
      <div className="overflow-x-auto max-h-64 overflow-y-auto code-scrollbar">
        <table className="w-full text-[13px] leading-relaxed">
          <tbody>
            {highlightedLines.map((line, idx) => (
              <tr key={idx} className={getLineHighlight(line.isDiffLine)}>
                <td className="pl-4 pr-3 py-1.5 text-right text-slate-500 select-none w-10 text-xs sticky left-0 bg-[#1e1e2e]">
                  {line.lineNumber}
                </td>
                <td className="pr-4 py-1.5 whitespace-pre">
                  {line.tokens.map((token, tidx) => (
                    <span key={tidx} className={TOKEN_COLORS[token.type] || 'text-slate-300'}>
                      {token.value}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple inline code highlight without line numbers
export function InlineCode({ code }: { code: string }) {
  const tokens = useMemo(() => tokenizeHtml(code), [code]);

  return (
    <code className="font-code text-sm">
      {tokens.map((token, idx) => (
        <span key={idx} className={TOKEN_COLORS[token.type] || 'text-slate-300'}>
          {token.value}
        </span>
      ))}
    </code>
  );
}
