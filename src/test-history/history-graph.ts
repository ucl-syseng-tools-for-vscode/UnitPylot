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
                    width: 600px; /* Adjust the width */
                    height: 400px; /* Adjust the height */
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
                
                const labels = rawData.map(entry => new Date(entry.date).toLocaleString());
                const passData = rawData.map(entry => entry.pass);
                const failData = rawData.map(entry => entry.fail);

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Pass',
                                data: passData,
                                borderColor: 'green',
                                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                                pointBackgroundColor: 'green',
                                pointBorderColor: 'green',
                                pointRadius: 5,
                                borderWidth: 2,
                                fill: false,
                                tension: 0.2
                            },
                            {
                                label: 'Fail',
                                data: failData,
                                borderColor: 'red',
                                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                pointBackgroundColor: 'red',
                                pointBorderColor: 'red',
                                pointRadius: 5,
                                borderWidth: 2,
                                fill: false,
                                tension: 0.2
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
                                title: { display: true, text: 'Test Count' },
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
