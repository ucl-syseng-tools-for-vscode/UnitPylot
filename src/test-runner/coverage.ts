export type FileCoverage = {
    filename: string;
    lines: {
        covered: number[];
        skipped: number[];
        missed: number[];
        branches_covered: number[][];
        branches_missed: number[][];
    };
    summary: {
        covered: number;
        skipped: number;
        missed: number;
        branches_covered: number;
        branches_missed: number;
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
        branches_covered: number;
        branches_missed: number;
        branches_total: number;
    };
};

export type FileCoverageRaw = {
    excluded_lines: [number];
    executed_lines: [number];
    missing_lines: [number];
    executed_branches: number[][];
    missing_branches: number[][];
    summary: {
        covered_lines: number;
        excluded_lines: number;
        missing_lines: number;
        branches_covered: number;
        branches_missed: number;
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

export function mergeCoverage(existing: Coverage, newCoverage: Coverage): Coverage {
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

            // Merge line coverage
            // Union
            existingFile.lines.covered = Array.from(
                new Set([...existingFile.lines.covered, ...newFile.lines.covered])
            );
            // Intersection
            existingFile.lines.skipped = existingFile.lines.skipped.filter(line =>
                newFile.lines.skipped.includes(line) && !existingFile.lines.covered.includes(line)
            );
            // Intersection
            existingFile.lines.missed = existingFile.lines.missed.filter(line =>
                newFile.lines.missed.includes(line) && !existingFile.lines.covered.includes(line)
            );

            // Merge branch coverage
            // Union
            existingFile.lines.branches_covered = Array.from(
                [...existingFile.lines.branches_covered, ...newFile.lines.branches_covered]
            );
            // Remove duplicates
            existingFile.lines.branches_covered = existingFile.lines.branches_covered.filter((branch, index, self) =>
                index === self.findIndex(t => t.every((line, index) => line === branch[index]))
            );

            // Intersection
            existingFile.lines.branches_missed = existingFile.lines.branches_missed.filter(branch =>
                newFile.lines.branches_missed.some(newBranch =>
                    branch.every((line, index) => line === newBranch[index])
                    && !existingFile.lines.branches_covered.some(existingBranch =>
                        branch.every((line, index) => line === existingBranch[index])
                    )
                ));

            // Recalculate file summary
            const totalLines = new Set([
                ...existingFile.lines.covered,
                ...existingFile.lines.skipped,
                ...existingFile.lines.missed,
            ]).size;
            const coveredLines = existingFile.lines.covered.length;
            const skippedLines = existingFile.lines.skipped.length;
            const missedLines = totalLines - coveredLines - skippedLines;

            // Now for branches
            const coveredBranches = existingFile.lines.branches_covered.length;
            const missedBranches = existingFile.lines.branches_missed.length;

            existingFile.summary = {
                covered: coveredLines,
                skipped: skippedLines,
                missed: missedLines,
                branches_covered: coveredBranches,
                branches_missed: missedBranches,
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
        totalBranchesCovered += file.summary.branches_covered;
        totalBranchesMissed += file.summary.branches_missed;
    }

    totalBranches = totalBranchesCovered + totalBranchesMissed;

    return {
        files: finalFiles,
        totals: {
            covered: totalCovered,
            skipped: totalSkipped,
            missed: totalMissed,
            total: totalLines,
            percentCovered: totalLines ? (totalCovered / totalLines) * 100 : 0,
            branches_covered: totalBranchesCovered,
            branches_missed: totalBranchesMissed,
            branches_total: totalBranches,
        },
    };
}
