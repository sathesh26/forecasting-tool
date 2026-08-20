const Charts = {
    instances: {},

    destroy(key) { if (this.instances[key]) { this.instances[key].destroy(); delete this.instances[key]; } },

    noGrid: { display: false, drawBorder: false, drawOnChartArea: false, drawTicks: false },

    renderDataChart(canvasId, labels, values, colName) {
        this.destroy('data');
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        this.instances.data = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Actual ' + (colName || ''), data: values, borderColor: '#9333ea', backgroundColor: 'rgba(147,51,234,.08)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#9333ea', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { usePointStyle: true, font: { size: 12 } } },
                tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : ''); } } }
            }, scales: { x: { grid: this.noGrid, ticks: { maxTicksLimit: 12, font: { size: 11 } } }, y: { grid: this.noGrid, ticks: { font: { size: 11 } } } } }
        });
    },

    renderComparisonChart(canvasId, modelNames, maeVals, rmseVals) {
        this.destroy('comparison');
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const bg = modelNames.map((_, i) => `hsla(${(i * 24) % 360}, 65%, 55%, .7)`);
        const bc = modelNames.map((_, i) => `hsla(${(i * 24) % 360}, 65%, 45%, 1)`);
        this.instances.comparison = new Chart(ctx, {
            type: 'bar',
            data: { labels: modelNames, datasets: [
                { label: 'MAE', data: maeVals, backgroundColor: bg, borderColor: bc, borderWidth: 1, borderRadius: 3 },
                { label: 'RMSE', data: rmseVals, backgroundColor: bg.map(c => c.replace('.7)', '.35)')), borderColor: bc, borderWidth: 1, borderRadius: 3 }
            ] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 12 } } } }, scales: { x: { grid: this.noGrid, ticks: { font: { size: 10 }, maxRotation: 45 } }, y: { grid: this.noGrid, ticks: { font: { size: 11 } } } } }
        });
    },

    renderForecastChart(canvasId, labels, actual, results, selectedModel, colName) {
        this.destroy('forecast');
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const colors = ['#9333ea','#10b981','#0ea5e9','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#e11d48','#a855f7','#22c55e','#eab308'];
        const datasets = [{ label: 'Actual ' + colName, data: actual, borderColor: '#1e293b', backgroundColor: 'rgba(30,41,59,.04)', fill: false, tension: 0.3, pointRadius: 2, borderWidth: 2.5 }];

        const forecastLabels = [];
        if (labels.length > 0) {
            const ld = new Date(labels[labels.length - 1]);
            for (let i = 1; i <= results[0].forecast.length; i++) forecastLabels.push(Utils.formatDate(Utils.nextDate(ld, App.state.frequency, i)));
        }
        const fullLabels = [...labels, ...forecastLabels];

        results.forEach((r, idx) => {
            if (selectedModel && r.name !== selectedModel) return;
            const pad = [...r.fitted, ...r.forecast];
            while (pad.length < fullLabels.length) pad.unshift(null);
            datasets.push({ label: r.name, data: pad, borderColor: colors[idx % colors.length], backgroundColor: 'transparent', borderDash: [5, 4], fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.8 });
        });

        this.instances.forecast = new Chart(ctx, {
            type: 'line',
            data: { labels: fullLabels, datasets },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 10 } } },
                    tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : ''); } } }
                },
                scales: { x: { grid: this.noGrid, ticks: { maxTicksLimit: 18, font: { size: 9 }, maxRotation: 45 } }, y: { grid: this.noGrid, ticks: { font: { size: 11 } } } }
            }
        });
    }
};
