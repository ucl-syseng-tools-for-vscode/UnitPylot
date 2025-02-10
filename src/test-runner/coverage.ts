export type FileCoverage = {
    filename: string;
    lines: {
        covered: [number];
        skipped: [number];
        missed: [number];
    };
    summary: {
        covered: number;
        skipped: number;
        missed: number;
        percentCovered: number;
        total: number;
    };
};

export type Coverage = {
    files: FileCoverage[];
    totals: {
        covered: number;
        skipped: number;
        missed: number;
        total: number;
        percentCovered: number;
        branches_covered?: number;
        branches_missed?: number;
        branches_total?: number;
    };
};

export type FileCoverageRaw = {
    excluded_lines: [number];
    executed_lines: [number];
    missing_lines: [number];
    summary: {
        covered_lines: number;
        excluded_lines: number;
        missing_lines: number;
        percent_covered: number;
        num_statements: number;
    };
}