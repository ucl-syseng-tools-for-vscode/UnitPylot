export function getCoverageWebviewContent(graphData: { date: Date, covered: number, missed: number, branchesCovered: number }[]): string {
    const dataStr = JSON.stringify(graphData);
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Coverage History</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .chart-container {
                    width: 800px;
                    height: 500px;
                }
                canvas {
                    width: 100% !important;
                    height: 100% !important;
                }
            </style>
        </head>
        <body>
            <div class="chart-container">
                <canvas id="coverageChart"></canvas>
            </div>
            <script>
                const ctx = document.getElementById('coverageChart').getContext('2d');
                const rawData = ${dataStr};
                
                const labels = rawData.map(entry => \`[\${new Date(entry.date).toLocaleString()}]\`);
                const coveredData = rawData.map(entry => entry.covered);
                const missedData = rawData.map(entry => entry.missed);
                const branchesCoveredData = rawData.map(entry => entry.branchesCovered);

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Covered Lines',
                                data: coveredData,
                                borderColor: '#327e36',
                                backgroundColor: 'rgba(50, 126, 54, 0.2)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.1
                            },
                            {
                                label: 'Missed Lines',
                                data: missedData,
                                borderColor: '#f14c4c',
                                backgroundColor: 'rgba(241, 76, 76, 0.2)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.1
                            },
                            {
                                label: 'Covered Branches',
                                data: branchesCoveredData,
                                borderColor: '#1e90ff',
                                backgroundColor: 'rgba(30, 144, 255, 0.2)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: { mode: 'index', intersect: false }
                        },
                        scales: {
                            x: {
                                title: { display: true, text: 'Time' },
                                ticks: { autoSkip: true, maxTicksLimit: 10 }
                            },
                            y: {
                                title: { display: true, text: 'Line Count' },
                                beginAtZero: true
                            }
                        }
                    }
                });
            </script>
        </body>
        </html>
    `;
}
