import { describe, it, expect } from 'vitest';

describe('Table Wizard & Excel/CSV Parser Logic', () => {
  function parsePastedTableData(pastedText: string) {
    if (!pastedText.trim()) return [];
    const sampleLine = pastedText.split(/\r?\n/)[0] || '';
    let delimiter = '\t';
    if (!sampleLine.includes('\t')) {
      if (sampleLine.includes(',')) delimiter = ',';
      else if (sampleLine.includes(';')) delimiter = ';';
    }

    const lines = pastedText.trim().split(/\r?\n/);
    return lines.map((line) => {
      return line.split(delimiter).map((c) => c.trim());
    });
  }

  function generateLatexTable(
    data: string[][],
    options: {
      tableStyle: 'booktabs' | 'bordered' | 'minimal';
      defaultAlign: 'l' | 'c' | 'r';
      caption: string;
      label: string;
      placement: string;
      centering: boolean;
      firstRowIsHeader: boolean;
    }
  ) {
    const effCols = Math.max(...data.map((r) => r.length), 1);
    const effRows = data.length;

    let colSpec = '';
    if (options.tableStyle === 'bordered') {
      colSpec = `|${Array(effCols).fill(options.defaultAlign).join('|')}|`;
    } else {
      colSpec = Array(effCols).fill(options.defaultAlign).join('');
    }

    let body = '';
    data.forEach((row, rIdx) => {
      const padded = [...row];
      while (padded.length < effCols) padded.push('');
      const sanitized = padded.map((cell) => cell.replace(/([%$#&_])/g, '\\$1'));

      if (rIdx === 0 && options.firstRowIsHeader) {
        body += `    ${sanitized.join(' & ')} \\\\\n`;
        if (options.tableStyle === 'booktabs') {
          body += `    \\midrule\n`;
        } else if (options.tableStyle === 'bordered') {
          body += `    \\hline\n`;
        }
      } else {
        body += `    ${sanitized.join(' & ')} \\\\\n`;
        if (options.tableStyle === 'bordered' && rIdx < effRows - 1) {
          body += `    \\hline\n`;
        }
      }
    });

    let result = '';
    result += `\\begin{table}[${options.placement}]\n`;
    if (options.centering) result += `  \\centering\n`;
    if (options.caption) result += `  \\caption{${options.caption}}\n`;
    if (options.label) result += `  \\label{${options.label}}\n`;
    result += `  \\begin{tabular}{${colSpec}}\n`;
    if (options.tableStyle === 'booktabs') result += `    \\toprule\n`;
    else if (options.tableStyle === 'bordered') result += `    \\hline\n`;
    result += body;
    if (options.tableStyle === 'booktabs') result += `    \\bottomrule\n`;
    else if (options.tableStyle === 'bordered') result += `    \\hline\n`;
    result += `  \\end{tabular}\n`;
    result += `\\end{table}\n`;
    return result;
  }

  it('should parse tab-separated Excel clipboard rows correctly', () => {
    const excelClip = "Col 1\tCol 2\tCol 3\nVal A\tVal B\t100\nVal C\tVal D\t200";
    const parsed = parsePastedTableData(excelClip);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual(['Col 1', 'Col 2', 'Col 3']);
    expect(parsed[1]).toEqual(['Val A', 'Val B', '100']);
    expect(parsed[2]).toEqual(['Val C', 'Val D', '200']);
  });

  it('should auto-detect comma-separated CSV text', () => {
    const csvData = "Name,Age,Role\nAlice,24,Engineer\nBob,30,Scientist";
    const parsed = parsePastedTableData(csvData);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual(['Name', 'Age', 'Role']);
    expect(parsed[1]).toEqual(['Alice', '24', 'Engineer']);
  });

  it('should generate valid booktabs LaTeX table code', () => {
    const data = [
      ['Metric', 'Method A', 'Method B'],
      ['Accuracy', '92.5%', '95.8%'],
      ['Latency', '12ms', '8ms'],
    ];
    const latex = generateLatexTable(data, {
      tableStyle: 'booktabs',
      defaultAlign: 'c',
      caption: 'Comparison Results',
      label: 'tab:comparison',
      placement: 'htbp',
      centering: true,
      firstRowIsHeader: true,
    });

    expect(latex).toContain('\\begin{table}[htbp]');
    expect(latex).toContain('\\centering');
    expect(latex).toContain('\\caption{Comparison Results}');
    expect(latex).toContain('\\label{tab:comparison}');
    expect(latex).toContain('\\begin{tabular}{ccc}');
    expect(latex).toContain('\\toprule');
    expect(latex).toContain('\\midrule');
    expect(latex).toContain('\\bottomrule');
    expect(latex).toContain('Metric & Method A & Method B \\\\');
    expect(latex).toContain('Accuracy & 92.5\\% & 95.8\\% \\\\');
  });

  it('should generate bordered tabular with \\hline for bordered style', () => {
    const data = [
      ['A', 'B'],
      ['1', '2'],
    ];
    const latex = generateLatexTable(data, {
      tableStyle: 'bordered',
      defaultAlign: 'l',
      caption: 'Bordered Table',
      label: 'tab:bordered',
      placement: '!ht',
      centering: true,
      firstRowIsHeader: true,
    });

    expect(latex).toContain('\\begin{tabular}{|l|l|}');
    expect(latex).toContain('\\hline');
  });
});

describe('Figure Wizard Logic', () => {
  function generateFigureSnippet(opts: {
    filename: string;
    caption: string;
    label: string;
    width: string;
    placement: string;
    centering: boolean;
  }) {
    let code = `\\begin{figure}[${opts.placement}]\n`;
    if (opts.centering) code += `  \\centering\n`;
    code += `  \\includegraphics[width=${opts.width}]{${opts.filename}}\n`;
    if (opts.caption) code += `  \\caption{${opts.caption}}\n`;
    if (opts.label) code += `  \\label{${opts.label}}\n`;
    code += `\\end{figure}\n`;
    return code;
  }

  it('should generate figure code with centering and width', () => {
    const code = generateFigureSnippet({
      filename: 'architecture.png',
      caption: 'System Architecture Diagram',
      label: 'fig:architecture',
      width: '0.8\\linewidth',
      placement: 'htbp',
      centering: true,
    });

    expect(code).toContain('\\begin{figure}[htbp]');
    expect(code).toContain('\\centering');
    expect(code).toContain('\\includegraphics[width=0.8\\linewidth]{architecture.png}');
    expect(code).toContain('\\caption{System Architecture Diagram}');
    expect(code).toContain('\\label{fig:architecture}');
    expect(code).toContain('\\end{figure}');
  });
});
