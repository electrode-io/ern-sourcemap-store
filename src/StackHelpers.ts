import { SourceMapConsumer } from "source-map";

const RE_FRAME_LOC_RED_SCREEN = /(.+)\n.+:(\d+):(\d+)/;
const RE_FRAME_NO_LOC_RED_SCREEN = /(.+)\n.+\[native code\]/;
const RE_FRAME_LOC_NATIVE = /(.+)@(\d+):(\d+)/;
const RE_FRAME_NO_LOC_NATIVE = /(.+)@-1/;
const RE_FRAME_NATIVE = new RegExp(
  `${RE_FRAME_LOC_NATIVE.source}|${RE_FRAME_NO_LOC_NATIVE.source}`,
);
const RE_FRAME_RED_SCREEN = new RegExp(
  `${RE_FRAME_LOC_RED_SCREEN.source}|${RE_FRAME_NO_LOC_RED_SCREEN.source}`,
  "g",
);

export function stackFromNativeString(s: string): StackFrame[] {
  const lines = s.split(/(?:\r\n|\r|\n)/g);
  return lines
    .map((l) => l.trim())
    .filter((l) => RE_FRAME_NATIVE.test(l))
    .map((l) => {
      if (RE_FRAME_LOC_NATIVE.test(l)) {
        const [, methodName, line, column] = l.match(RE_FRAME_LOC_NATIVE);
        return {
          column: parseInt(column, 10),
          line: parseInt(line, 10),
          methodName,
        } as StackFrame;
      } else if (RE_FRAME_NO_LOC_NATIVE.test(l)) {
        const [, methodName] = l.match(RE_FRAME_NO_LOC_NATIVE);
        return {
          column: undefined,
          line: undefined,
          methodName,
        } as StackFrame;
      }
    });
}

export function stackFromRedScreenString(s: string): StackFrame[] {
  let matches;
  const result = [];
  while (true) {
    matches = RE_FRAME_RED_SCREEN.exec(s);
    if (!matches) {
      break;
    } else {
      const [, methodName, line, column, mn] = matches;
      result.push({
        column: parseInt(column, 10) || undefined,
        line: parseInt(line, 10) || undefined,
        methodName: methodName ? methodName.trim() : mn.trim(),
      });
    }
  }
  return result;
}

export function stackToString(stack: StackFrame[]) {
  return stack
    .map((s) => `${s.methodName}@${s.line}:${s.column} [${s.file}]`)
    .join("\n");
}

export async function symbolicate(
  stack: StackFrame[],
  sourceMap: string,
): Promise<StackFrame[]> {
  const consumer = await new SourceMapConsumer(JSON.parse(sourceMap));
  try {
    return stack.map((frame: StackFrame) => {
      if (frame.column && frame.line) {
        const originalPos = consumer.originalPositionFor({
          column: frame.column,
          line: frame.line,
        });
        return {
          column: originalPos.column,
          file: originalPos.source,
          line: originalPos.line,
          methodName: frame.methodName,
        };
      } else {
        return frame;
      }
    });
  } finally {
    consumer.destroy();
  }
}
