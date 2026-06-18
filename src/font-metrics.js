const BASE_WIDTHS = {
  Helvetica: {
    ' ': 278,
    '!': 278,
    '"': 355,
    '#': 556,
    $: 556,
    '%': 889,
    '&': 667,
    "'": 191,
    '(': 333,
    ')': 333,
    '*': 389,
    '+': 584,
    ',': 278,
    '-': 333,
    '.': 278,
    '/': 278,
    ':': 278,
    ';': 278,
    '<': 584,
    '=': 584,
    '>': 584,
    '?': 556,
    '@': 1015,
    '[': 278,
    '\\': 278,
    ']': 278,
    '^': 469,
    _: 556,
    '`': 333,
    '{': 334,
    '|': 260,
    '}': 334,
    '~': 584
  },
  'Helvetica-Bold': {
    ' ': 278,
    '!': 333,
    '"': 474,
    '#': 556,
    $: 556,
    '%': 889,
    '&': 722,
    "'": 238,
    '(': 333,
    ')': 333,
    '*': 389,
    '+': 584,
    ',': 278,
    '-': 333,
    '.': 278,
    '/': 278,
    ':': 333,
    ';': 333,
    '<': 584,
    '=': 584,
    '>': 584,
    '?': 611,
    '@': 975,
    '[': 333,
    '\\': 278,
    ']': 333,
    '^': 584,
    _: 556,
    '`': 333,
    '{': 389,
    '|': 280,
    '}': 389,
    '~': 584
  },
  'Times-Roman': {
    ' ': 250,
    '!': 333,
    '"': 408,
    '#': 500,
    $: 500,
    '%': 833,
    '&': 778,
    "'": 180,
    '(': 333,
    ')': 333,
    '*': 500,
    '+': 564,
    ',': 250,
    '-': 333,
    '.': 250,
    '/': 278,
    ':': 278,
    ';': 278,
    '<': 564,
    '=': 564,
    '>': 564,
    '?': 444,
    '@': 921,
    '[': 333,
    '\\': 278,
    ']': 333,
    '^': 469,
    _: 500,
    '`': 333,
    '{': 480,
    '|': 200,
    '}': 480,
    '~': 541
  },
  'Times-Bold': {
    ' ': 250,
    '!': 333,
    '"': 555,
    '#': 500,
    $: 500,
    '%': 1000,
    '&': 833,
    "'": 278,
    '(': 333,
    ')': 333,
    '*': 500,
    '+': 570,
    ',': 250,
    '-': 333,
    '.': 250,
    '/': 278,
    ':': 333,
    ';': 333,
    '<': 570,
    '=': 570,
    '>': 570,
    '?': 500,
    '@': 930,
    '[': 333,
    '\\': 278,
    ']': 333,
    '^': 581,
    _: 500,
    '`': 333,
    '{': 394,
    '|': 220,
    '}': 394,
    '~': 520
  }
};

const DIGIT_WIDTHS = {
  Helvetica: 556,
  'Helvetica-Bold': 556,
  'Times-Roman': 500,
  'Times-Bold': 500
};

const UPPER_WIDTHS = {
  Helvetica: {
    A: 667,
    B: 667,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 500,
    K: 667,
    L: 556,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611
  },
  'Helvetica-Bold': {
    A: 722,
    B: 722,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 556,
    K: 722,
    L: 611,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611
  },
  'Times-Roman': {
    A: 722,
    B: 667,
    C: 667,
    D: 722,
    E: 611,
    F: 556,
    G: 722,
    H: 722,
    I: 333,
    J: 389,
    K: 722,
    L: 611,
    M: 889,
    N: 722,
    O: 722,
    P: 556,
    Q: 722,
    R: 667,
    S: 556,
    T: 611,
    U: 722,
    V: 722,
    W: 944,
    X: 722,
    Y: 722,
    Z: 611
  },
  'Times-Bold': {
    A: 722,
    B: 667,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 778,
    I: 389,
    J: 500,
    K: 778,
    L: 667,
    M: 944,
    N: 722,
    O: 778,
    P: 611,
    Q: 778,
    R: 722,
    S: 556,
    T: 667,
    U: 722,
    V: 722,
    W: 1000,
    X: 722,
    Y: 722,
    Z: 667
  }
};

const LOWER_WIDTHS = {
  Helvetica: {
    a: 556,
    b: 556,
    c: 500,
    d: 556,
    e: 556,
    f: 278,
    g: 556,
    h: 556,
    i: 222,
    j: 222,
    k: 500,
    l: 222,
    m: 833,
    n: 556,
    o: 556,
    p: 556,
    q: 556,
    r: 333,
    s: 500,
    t: 278,
    u: 556,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 500
  },
  'Helvetica-Bold': {
    a: 556,
    b: 611,
    c: 556,
    d: 611,
    e: 556,
    f: 333,
    g: 611,
    h: 611,
    i: 278,
    j: 278,
    k: 556,
    l: 278,
    m: 889,
    n: 611,
    o: 611,
    p: 611,
    q: 611,
    r: 389,
    s: 556,
    t: 333,
    u: 611,
    v: 556,
    w: 778,
    x: 556,
    y: 556,
    z: 500
  },
  'Times-Roman': {
    a: 444,
    b: 500,
    c: 444,
    d: 500,
    e: 444,
    f: 333,
    g: 500,
    h: 500,
    i: 278,
    j: 278,
    k: 500,
    l: 278,
    m: 778,
    n: 500,
    o: 500,
    p: 500,
    q: 500,
    r: 333,
    s: 389,
    t: 278,
    u: 500,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 444
  },
  'Times-Bold': {
    a: 500,
    b: 556,
    c: 444,
    d: 556,
    e: 444,
    f: 333,
    g: 500,
    h: 556,
    i: 278,
    j: 333,
    k: 556,
    l: 278,
    m: 833,
    n: 556,
    o: 500,
    p: 556,
    q: 556,
    r: 444,
    s: 389,
    t: 333,
    u: 556,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 444
  }
};

const FONT_ALIASES = new Map([
  ['F1', 'Helvetica'],
  ['F2', 'Helvetica-Bold'],
  ['F3', 'Times-Bold'],
  ['F4', 'Times-Roman']
]);

export function measureText(text, fontName, size) {
  const family = resolveFontFamily(fontName);
  let width = 0;

  for (const character of String(text || '')) {
    width += widthForCharacter(character, family);
  }

  return (width / 1000) * size;
}

export function truncateToWidth(text, fontName, size, maxWidth) {
  const cleanText = String(text || '');

  if (measureText(cleanText, fontName, size) <= maxWidth) {
    return { text: cleanText, truncated: false };
  }

  const ellipsis = '...';
  let result = cleanText;

  while (result.length > 0 && measureText(`${result.trimEnd()}${ellipsis}`, fontName, size) > maxWidth) {
    result = result.slice(0, -1);
  }

  return {
    text: result.length > 0 ? `${result.trimEnd()}${ellipsis}` : ellipsis,
    truncated: true
  };
}

export function wrapText(text, fontName, size, maxWidth, maxLines, options = {}) {
  const words = tokenizeForWrap(text).flatMap((word) => splitLongWord(word, fontName, size, maxWidth));
  const lines = [];
  let current = '';
  let truncated = false;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (measureText(candidate, fontName, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      const truncatedWord = truncateToWidth(word, fontName, size, maxWidth);
      lines.push(truncatedWord.text);
      truncated = truncated || truncatedWord.truncated;
      current = '';
    }

    if (lines.length >= maxLines) {
      truncated = true;
      current = '';
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current) {
    truncated = true;
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }

  if (truncated && options.ellipsis !== false && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const fitted = truncateToWidth(`${lines[lastIndex]}...`, fontName, size, maxWidth);
    lines[lastIndex] = fitted.text;
  }

  return {
    lines: lines.length > 0 ? lines : [''],
    truncated
  };
}

function resolveFontFamily(fontName) {
  return FONT_ALIASES.get(fontName) || fontName || 'Helvetica';
}

function widthForCharacter(character, family) {
  if (character >= '0' && character <= '9') {
    return DIGIT_WIDTHS[family] || 500;
  }

  if (character >= 'A' && character <= 'Z') {
    return UPPER_WIDTHS[family]?.[character] || 667;
  }

  if (character >= 'a' && character <= 'z') {
    return LOWER_WIDTHS[family]?.[character] || 500;
  }

  return BASE_WIDTHS[family]?.[character] || 500;
}

function tokenizeForWrap(text) {
  return String(text || '')
    .replace(/([/-])/g, '$1 ')
    .split(/\s+/)
    .filter(Boolean);
}

function splitLongWord(word, fontName, size, maxWidth) {
  if (measureText(word, fontName, size) <= maxWidth) {
    return [word];
  }

  const parts = [];
  let current = '';

  for (const character of word) {
    const candidate = `${current}${character}`;

    if (candidate && measureText(candidate, fontName, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      parts.push(current);
    }

    current = character;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}
