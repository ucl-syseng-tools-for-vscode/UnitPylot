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
            <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom"></script>
            <style>
                body {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    overflow: hidden;
                }
                .chart-container {
                    width: 800px;
                    height: 500px;
                    overflow-x: auto;
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

                const labels = rawData.map(entry => new Date(entry.date).toLocaleDateString());
                const fullLabels = rawData.map(entry => new Date(entry.date).toLocaleString());
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
                                backgroundColor: 'rgba(50, 126, 54, 0.3)',
                                borderColor: '#327e36',
                                borderWidth: 2,
                                barPercentage: 0.8,
                                categoryPercentage: 0.9
                            },
                            {
                                label: 'Fail',
                                data: failData,
                                backgroundColor: 'rgba(241, 76, 76, 0.3)',
                                borderColor: '#f14c4c',
                                borderWidth: 2,
                                barPercentage: 0.8,
                                categoryPercentage: 0.9
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                callbacks: {
                                    title: (tooltipItems) => {
                                        return fullLabels[tooltipItems[0].dataIndex]; // Show full timestamp on hover
                                    }
                                }
                            },
                            zoom: {
                                pan: {
                                    enabled: true,
                                    mode: 'x'
                                },
                                zoom: {
                                    wheel: {
                                        enabled: true
                                    },
                                    pinch: {
                                        enabled: true
                                    },
                                    mode: 'x'
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: { display: true, text: 'Time' },
                                ticks: {
                                    autoSkip: false,
                                    maxRotation: 45,
                                    minRotation: 45
                                },
                                min: 0,
                                max: 4 // Show only 5 entries at a time
                            },
                            y: {
                                title: { display: true, text: 'Test Count' },
                                beginAtZero: true,
                                ticks: {
                                    precision: 0
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
