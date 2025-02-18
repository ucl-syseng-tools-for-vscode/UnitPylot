export type FileCoverage = {
    filename: string;
    lines: {
        covered: number[];
        skipped: number[];
        missed: number[];
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

/**
 * Merges two coverage reports together
 * @param existing The existing coverage report
 * @param newCoverage The new coverage report to merge
 * @returns The merged coverage report
 */

export function mergeCoverage(existing: Coverage, newCoverage: Coverage): Coverage {  // TODO: This was all ChatGPT so test thoroughly
    const mergedFiles: Record<string, FileCoverage> = {};

    // Merge existing files into the map
    for (const file of existing.files) {
        mergedFiles[file.filename] = { ...file };
    }

    // Process new coverage files
    for (const newFile of newCoverage.files) {
        if (mergedFiles[newFile.filename]) {
            // Merge with existing file
            const existingFile = mergedFiles[newFile.filename];

            existingFile.lines.covered = Array.from(
                new Set([...existingFile.lines.covered, ...newFile.lines.covered])
            );
            existingFile.lines.skipped = Array.from(
                new Set([...existingFile.lines.skipped, ...newFile.lines.skipped])
            );
            existingFile.lines.missed = Array.from(
                new Set([...existingFile.lines.missed, ...newFile.lines.missed])
            );

            // Recalculate file summary
            const totalLines = new Set([
                ...existingFile.lines.covered,
                ...existingFile.lines.skipped,
                ...existingFile.lines.missed,
            ]).size;
            const coveredLines = existingFile.lines.covered.length;
            const skippedLines = existingFile.lines.skipped.length;
            const missedLines = totalLines - coveredLines - skippedLines;

            existingFile.summary = {
                covered: coveredLines,
                skipped: skippedLines,
                missed: missedLines,
                total: totalLines,
                percentCovered: totalLines ? (coveredLines / totalLines) * 100 : 0,
            };
        } else {
            // New file, add it
            mergedFiles[newFile.filename] = { ...newFile };
        }
    }

    // Remove deleted files (only keep files present in the new coverage report)
    const finalFiles = Object.values(mergedFiles).filter(file =>
        newCoverage.files.some(newFile => newFile.filename === file.filename)
    );

    // Recalculate overall summary, including branch coverage
    let totalCovered = 0,
        totalSkipped = 0,
        totalMissed = 0,
        totalLines = 0,
        totalBranchesCovered = 0,
        totalBranchesMissed = 0,
        totalBranches = 0;

    for (const file of finalFiles) {
        totalCovered += file.summary.covered;
        totalSkipped += file.summary.skipped;
        totalMissed += file.summary.missed;
        totalLines += file.summary.total;
    }

    // Merge branch coverage if present
    if (existing.totals.branches_total !== undefined || newCoverage.totals.branches_total !== undefined) {
        totalBranchesCovered =
            (existing.totals.branches_covered ?? 0) + (newCoverage.totals.branches_covered ?? 0);
        totalBranchesMissed =
            (existing.totals.branches_missed ?? 0) + (newCoverage.totals.branches_missed ?? 0);
        totalBranches =
            (existing.totals.branches_total ?? 0) + (newCoverage.totals.branches_total ?? 0);
    }

    return {
        files: finalFiles,
        totals: {
            covered: totalCovered,
            skipped: totalSkipped,
            missed: totalMissed,
            total: totalLines,
            percentCovered: totalLines ? (totalCovered / totalLines) * 100 : 0,
            branches_covered: totalBranchesCovered || undefined,
            branches_missed: totalBranchesMissed || undefined,
            branches_total: totalBranches || undefined,
        },
    };
}
