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
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #121212; /* Dark background */
                    color: white;
                }
                .chart-container {
                    width: 800px;
                    height: 500px;
                    position: relative;
                }
                canvas {
                    width: 100% !important;
                    height: 100% !important;
                }
                .x-axis-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    margin-top: -35px;
                    margin-left: 50px;
                    position: relative;
                    z-index: 10;
                }
                .nav-card {
                    background: rgba(255, 255, 255, 0.08); /* Translucent effect */
                    padding: 6px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    cursor: pointer;
                    transition: border 0.2s ease-in-out, background 0.2s ease-in-out;
                }
                .nav-card:hover {
                    border: 1px solid white;
                    background: rgba(255, 255, 255, 0.15);
                }
                .nav-button {
                    font-size: 14px;
                    background: none;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                .x-axis-label {
                    font-size: 16px;
                    color: white;
                }
            </style>
        </head>
        <body>
            <div class="chart-container">
                <canvas id="testHistoryChart"></canvas>
            </div>
            <div class="x-axis-container">
                <div class="nav-card">
                    <button id="backBtn" class="nav-button">Previous</button>
                </div>
                <span class="x-axis-label">Time</span>
                <div class="nav-card">
                    <button id="nextBtn" class="nav-button">Next</button>
                </div>
            </div>
            <script>
                const ctx = document.getElementById('testHistoryChart').getContext('2d');
                const rawData = ${dataStr};

                const labels = rawData.map(entry => new Date(entry.date).toLocaleDateString());
                const fullLabels = rawData.map(entry => new Date(entry.date).toLocaleString());
                const passData = rawData.map(entry => entry.pass);
                const failData = rawData.map(entry => entry.fail);

                let currentStart = 0;
                const maxVisiblePoints = 5;

                function updateChartRange() {
                    const chart = Chart.getChart("testHistoryChart");
                    if (!chart) return;
                    chart.options.scales.x.min = currentStart;
                    chart.options.scales.x.max = Math.min(currentStart + maxVisiblePoints - 1, labels.length - 1);
                    chart.update();
                }

                const chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Pass',
                                data: passData,
                                backgroundColor: 'rgba(50, 126, 54, 0.3)',
                                borderColor: 'rgba(70, 140, 70, 0.6)',
                                borderWidth: 2,
                                barPercentage: 0.8,
                                categoryPercentage: 0.9
                            },
                            {
                                label: 'Fail',
                                data: failData,
                                backgroundColor: 'rgba(241, 76, 76, 0.3)',
                                borderColor: 'rgba(170, 90, 90, 0.6)',
                                borderWidth: 2,
                                barPercentage: 0.8,
                                categoryPercentage: 0.9
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                top: 50, 
                                bottom: 20, /* Extra spacing for x-axis labels */
                                left: 20, /* Extra spacing for y-axis label */
                                right: 20
                            }
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                                align: 'end',
                                labels: { 
                                    color: 'white',
                                    font: {
                                        size: 16
                                    },
                                    padding: 15 /* Moves the Pass/Fail legend further apart */
                                }
                            },
                            tooltip: {
                                titleColor: 'white',
                                bodyColor: 'white',
                                callbacks: {
                                    title: (tooltipItems) => {
                                        return fullLabels[tooltipItems[0].dataIndex];
                                    }
                                }
                            },
                            zoom: {
                                pan: {
                                    enabled: true,
                                    mode: 'x' /* Allows horizontal panning */
                                },
                                zoom: {
                                    wheel: {
                                        enabled: true /* Zoom in/out with mouse wheel */
                                    },
                                    pinch: {
                                        enabled: true /* Allows pinch zooming on touch devices */
                                    },
                                    mode: 'x', /* Only zooms horizontally */
                                    limits: {
                                        x: { min: 0, max: labels.length - 1 } /* Prevents zooming out too far */
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: { 
                                    display: false, /* Removed default title since we're manually placing it */
                                },
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.2)'
                                },
                                ticks: {
                                    color: 'rgba(0, 0, 0, 0)',
                                    font: {
                                        size: 14
                                    },
                                    autoSkip: false,
                                    maxRotation: 0,
                                    minRotation: 0
                                },
                                min: 0,
                                max: maxVisiblePoints - 1
                            },
                            y: {
                                suggestedMax: Math.max(...passData, ...failData) * 1.01,
                                title: { 
                                    display: true, 
                                    text: 'Test Count', 
                                    color: 'white',
                                    font: {
                                        size: 16
                                    },
                                    padding: { bottom: 10 }
                                },
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.2)'
                                },
                                ticks: {
                                    color: 'white',
                                    precision: 0,
                                    font: {
                                        size: 14
                                    }
                                }
                            }
                        }
                    }
                });

                document.getElementById("nextBtn").addEventListener("click", () => {
                    if (currentStart + maxVisiblePoints < labels.length) {
                        currentStart++;
                        updateChartRange();
                    }
                });

                document.getElementById("backBtn").addEventListener("click", () => {
                    if (currentStart > 0) {
                        currentStart--;
                        updateChartRange();
                    }
                });
            </script>
        </body>
        </html>
    `;
}
