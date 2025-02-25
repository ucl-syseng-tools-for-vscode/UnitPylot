export function getWebviewContent(graphData: { date: Date, pass: number, fail: number }[]): string {
    const dataStr = JSON.stringify(graphData);
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Test Pass/Fail History</title>
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
                <canvas id="testHistoryChart"></canvas>
            </div>
            <script>
                const ctx = document.getElementById('testHistoryChart').getContext('2d');
                const rawData = ${dataStr};
                
                const labels = rawData.map(entry => \`[\${new Date(entry.date).toLocaleString()}]\`);
                const passData = rawData.map(entry => entry.pass);
                const failData = rawData.map(entry => entry.fail);

                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Pass',
                                data: passData,
                                backgroundColor: '#327e36',
                                borderColor: '#327e36',
                                borderWidth: 1,
                                barPercentage: 0.45,
                                categoryPercentage: 0.8
                            },
                            {
                                label: 'Fail',
                                data: failData,
                                backgroundColor: '#f14c4c',
                                borderColor: '#f14c4c',
                                borderWidth: 1,
                                barPercentage: 0.45,
                                categoryPercentage: 0.8
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
                                ticks: { autoSkip: true, maxTicksLimit: 10 },
                                stacked: false
                            },
                            y: {
                                title: { display: true, text: 'Test Count' },
                                beginAtZero: true,
                                ticks: {
                                    precision: 0 // Ensures only whole numbers
                                }
                            }
                        }
                    }
                });
            </script>
        </body>
        </html>
    `;
}
