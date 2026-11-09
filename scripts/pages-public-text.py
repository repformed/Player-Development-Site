"""Compare public HTML while permitting only existing plain-text spans to change."""
from html.parser import HTMLParser
import json
import sys

class TextSpans(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.lines = source.splitlines(keepends=True)
        self.starts = [0]
        for line in self.lines:
            self.starts.append(self.starts[-1] + len(line))
        self.stack = []
        self.spans = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'textarea', 'xmp', 'iframe', 'noembed', 'plaintext'):
            self.stack.append(tag)
    def handle_endtag(self, tag):
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
    def handle_data(self, data):
        if not self.stack and data.strip():
            line, offset = self.getpos()
            start = self.starts[line-1] + offset
            self.spans.append((start, start + len(data), data))

def compare(old, new):
    parsers = [TextSpans(old), TextSpans(new)]
    for p in parsers:
        p.feed(p.source)
        p.close()
        if p.stack:
            raise ValueError('Unclosed protected HTML text')
    if len(parsers[0].spans) != len(parsers[1].spans):
        raise ValueError('Text-span structure changed')
    for a, b in zip(parsers[0].spans, parsers[1].spans):
        if a[2] != b[2] and any(c in b[2] for c in '<>&'):
            raise ValueError('Only literal plain text is eligible')
    normalized = []
    for p in parsers:
        s = p.source
        for a,b,_ in reversed(p.spans):
            s = s[:a] + '__PUBLIC_TEXT__' + s[b:]
        normalized.append(s)
    if normalized[0] != normalized[1]:
        raise ValueError('HTML bytes outside plain text changed')

if __name__ == '__main__':
    try:
        data = json.load(sys.stdin)
        compare(data['old'], data['new'])
        print('public HTML text-only comparison passed')
    except (ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from None
