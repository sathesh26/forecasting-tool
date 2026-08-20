const App = {
    state: { rawData: null, columns: [], dateCol: '', valueCol: '', dates: [], values: [], frequency: 'M', forecastResults: [] },

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => { if (btn.dataset.view) this.navigate(btn.dataset.view); });
        });
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
        uploadZone.addEventListener('drop', (e) => { e.preventDefault(); uploadZone.classList.remove('drag-over'); if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]); });
        fileInput.addEventListener('change', () => { if (fileInput.files.length) this.handleFile(fileInput.files[0]); });
        document.getElementById('btnSampleCsv').addEventListener('click', (e) => { e.stopPropagation(); DataLoader.downloadSampleCSV(); });
        document.getElementById('btnSampleExcel').addEventListener('click', (e) => { e.stopPropagation(); DataLoader.downloadSampleExcel(); });
        document.getElementById('btnTrySample').addEventListener('click', (e) => { e.stopPropagation(); this.loadSample(); });
        document.getElementById('btnRunForecast').addEventListener('click', () => this.runForecast());
        document.getElementById('btnExportCsv').addEventListener('click', () => this.exportCsv());
        document.getElementById('resultModelSelect').addEventListener('change', (e) => this.updateForecastChart(e.target.value));
        document.getElementById('menuToggle').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('open'); this.toggleOverlay(); });
        document.getElementById('btnGuide').addEventListener('click', () => this.showGuide());
        document.getElementById('modalClose').addEventListener('click', () => this.hideGuide());
        document.getElementById('guideModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) this.hideGuide(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hideGuide(); });
    },

    toggleOverlay() {
        let o = document.querySelector('.sidebar-overlay');
        if (!o) { o = document.createElement('div'); o.className = 'sidebar-overlay'; o.addEventListener('click', () => { document.getElementById('sidebar').classList.remove('open'); o.classList.remove('active'); }); document.body.appendChild(o); }
        o.classList.toggle('active', document.getElementById('sidebar').classList.contains('open'));
    },

    navigate(view) {
        if (view === 'guide') { this.showGuide(); return; }
        if (view === 'about') { this.showGuide('about'); return; }

        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));

        const sectionMap = {
            'workspace': null,
            'preview': 'section-preview',
            'comparison': 'section-comparison',
            'results': 'section-results'
        };

        const sectionId = sectionMap[view];
        if (sectionId) {
            const el = document.getElementById(sectionId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        const sb = document.getElementById('sidebar');
        if (sb && sb.classList.contains('open')) { sb.classList.remove('open'); const o = document.querySelector('.sidebar-overlay'); if (o) o.classList.remove('active'); }
    },

    showGuide(tab) {
        const modal = document.getElementById('guideModal');
        const guideContent = document.getElementById('guideContent');
        const aboutContent = document.getElementById('aboutContent');
        const title = document.getElementById('guideModalTitle');
        if (tab === 'about') {
            guideContent.style.display = 'none';
            aboutContent.style.display = 'block';
            title.textContent = 'About This Tool';
        } else {
            guideContent.style.display = 'block';
            aboutContent.style.display = 'none';
            title.textContent = 'User Guide';
        }
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    hideGuide() {
        document.getElementById('guideModal').classList.remove('open');
        document.body.style.overflow = '';
    },

    enableNav(view) {
        const b = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (b) { b.classList.remove('disabled'); b.removeAttribute('disabled'); b.title = ''; }
    },

    showSection(id) {
        document.getElementById(id).classList.remove('hidden');
    },

    async handleFile(file) {
        try { const data = await DataLoader.loadFile(file); this.loadIntoState(data); } catch (e) { alert('Error: ' + e.message); }
    },

    loadSample() {
        try {
            const rows = DataLoader.generateSampleData();
            this.loadIntoState(rows);
        } catch (e) { console.error(e); alert('Error: ' + e.message); }
    },

    loadIntoState(data) {
        this.state.rawData = data;
        this.state.columns = DataLoader.getColumns(data);
        this.state.dateCol = DataLoader.detectDateColumn(this.state.columns, data);
        this.state.valueCol = DataLoader.detectValueColumn(this.state.columns, data);
        const { dates, values } = DataLoader.extractSeries(data, this.state.dateCol, this.state.valueCol);
        this.state.dates = dates;
        this.state.values = values;
        this.state.frequency = Utils.detectFrequency(dates.map(d => Utils.formatDate(d)));
        this.populateConfig();
        this.showStep2();
        this.renderPreview();
        this.showSection('section-preview');
        this.enableNav('preview');
        document.getElementById('step2Card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    populateConfig() {
        const d = document.getElementById('dateCol'), v = document.getElementById('valueCol');
        d.innerHTML = this.state.columns.map(c => `<option value="${c}" ${c === this.state.dateCol ? 'selected' : ''}>${c}</option>`).join('');
        v.innerHTML = this.state.columns.map(c => `<option value="${c}" ${c === this.state.valueCol ? 'selected' : ''}>${c}</option>`).join('');
    },

    updateSeries() {
        this.state.dateCol = document.getElementById('dateCol').value;
        this.state.valueCol = document.getElementById('valueCol').value;
        const { dates, values } = DataLoader.extractSeries(this.state.rawData, this.state.dateCol, this.state.valueCol);
        this.state.dates = dates; this.state.values = values;
        this.state.frequency = Utils.detectFrequency(dates.map(d => Utils.formatDate(d)));
    },

    showStep2() { document.getElementById('step2Card').classList.remove('hidden'); },

    renderPreview() {
        const { values, dates, columns } = this.state;
        if (!values.length) return;
        const stats = DataLoader.getStats(values);
        document.getElementById('dataStats').innerHTML = [
            { l: 'Rows', v: stats.count }, { l: 'Mean', v: stats.mean }, { l: 'Std Dev', v: stats.std },
            { l: 'Min', v: stats.min }, { l: 'Max', v: stats.max }, { l: 'Sum', v: stats.sum }
        ].map(s => `<div class="stat-card"><div class="stat-label">${s.l}</div><div class="stat-value">${s.v}</div></div>`).join('');
        document.getElementById('dataTableHead').innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
        document.getElementById('dataTableBody').innerHTML = this.state.rawData.slice(0, 100).map(row => `<tr>${columns.map(c => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`).join('');
        try { Charts.renderDataChart('dataChart', dates.map(d => Utils.formatDate(d)), values); } catch (e) { console.warn(e); }
    },

    runForecast() {
        try {
            this.updateSeries();
            const sp = parseInt(document.getElementById('seasonalPeriod').value) || 12;
            const horizon = parseInt(document.getElementById('horizon').value) || 12;
            const freq = document.getElementById('frequency').value;
            if (freq !== 'auto') this.state.frequency = freq;
            const models = {};
            document.querySelectorAll('[data-model]').forEach(cb => { models[cb.dataset.model] = cb.checked; });
            const trend = Utils.detectTrend(this.state.values);
            const season = Utils.detectSeasonality(this.state.values, sp);
            const hasTrend = trend.direction !== 'Flat';
            const hasSeasonality = season.detected;

            document.getElementById('stepProgress').classList.remove('hidden');
            document.getElementById('stepProgress').scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                try {
                    this.state.forecastResults = Models.runAll(this.state.values, { horizon, seasonalPeriod: sp, models, hasTrend, hasSeasonality });
                    document.getElementById('stepProgress').classList.add('hidden');
                    this.renderComparison();
                    this.renderResults();
                    this.showSection('section-comparison');
                    this.showSection('section-results');
                    this.enableNav('comparison');
                    this.enableNav('results');
                    document.getElementById('section-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (e) { console.error(e); document.getElementById('stepProgress').classList.add('hidden'); alert('Error: ' + e.message); }
            }, 400);
        } catch (e) { console.error(e); alert('Error: ' + e.message); }
    },

    renderComparison() {
        const results = this.state.forecastResults;
        if (!results.length) return;
        const body = document.getElementById('comparisonBody');
        const rows = results.map(r => {
            const inS = r.fitted.filter(v => v !== null);
            const act = this.state.values.slice(0, inS.length);
            return { name: r.name, mae: Utils.mae(act, inS), rmse: Utils.rmse(act, inS), mape: Utils.mape(act, inS), r2: Utils.r2(act, inS) };
        });
        const bestMae = Math.min(...rows.map(r => r.mae)), bestRmse = Math.min(...rows.map(r => r.rmse));
        const bestMape = Math.min(...rows.map(r => r.mape)), bestR2 = Math.max(...rows.map(r => r.r2));
        body.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.name}</strong></td>
            <td class="${r.mae === bestMae ? 'best-metric' : ''}">${r.mae.toFixed(4)}</td>
            <td class="${r.rmse === bestRmse ? 'best-metric' : ''}">${r.rmse.toFixed(4)}</td>
            <td class="${r.mape === bestMape ? 'best-metric' : ''}">${r.mape.toFixed(2)}</td>
            <td class="${r.r2 === bestR2 ? 'best-metric' : ''}">${r.r2.toFixed(4)}</td>
        </tr>`).join('');
        try { Charts.renderComparisonChart('comparisonChart', rows.map(r => r.name), rows.map(r => r.mae), rows.map(r => r.rmse)); } catch (e) { console.warn(e); }
    },

    renderResults() {
        const results = this.state.forecastResults;
        if (!results.length) return;
        const vals = this.state.values;
        const dates = this.state.dates;
        const horizon = results[0].forecast.length;

        const metrics = results.map(r => {
            const inS = r.fitted.filter(v => v !== null);
            const act = vals.slice(0, inS.length);
            return { name: r.name, rmse: Utils.rmse(act, inS), fitted: r.fitted, forecast: r.forecast };
        });
        const best = metrics.reduce((a, b) => a.rmse < b.rmse ? a : b);

        document.getElementById('recModelName').textContent = best.name;
        document.getElementById('recRMSE').textContent = best.rmse.toFixed(2);

        const trend = Utils.detectTrend(vals);
        document.getElementById('resultTrendDir').textContent = trend.direction + ' trend';
        document.getElementById('resultTrendDesc').textContent = `Strength: ${(trend.strength * 100).toFixed(0)}%`;

        const sp = parseInt(document.getElementById('seasonalPeriod').value) || 12;
        const season = Utils.detectSeasonality(vals, sp);
        document.getElementById('resultSeasonInfo').textContent = season.detected ? `Detected (period ${season.period})` : 'Not detected';
        document.getElementById('resultSeasonDesc').textContent = season.detected ? `Seasonal strength: ${season.strength}%` : 'No clear repeating pattern';

        const quality = Utils.dataQuality(vals);
        document.getElementById('qualityScore').textContent = quality + '/100';
        document.getElementById('qualityFill').style.width = quality + '%';
        const anomalies = Utils.detectAnomalies(vals);
        document.getElementById('qualityAnomalies').textContent = anomalies.count + ' potential anomalies';
        document.getElementById('anomalyCount').textContent = anomalies.count;

        const histAvg = Utils.mean(vals);
        document.getElementById('histAvg').textContent = histAvg.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        document.getElementById('histObs').textContent = vals.length + ' observations';

        const forecastAvg = Utils.mean(best.forecast);
        document.getElementById('forecastAvg').textContent = forecastAvg.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        document.getElementById('forecastPeriods').textContent = horizon + ' periods ahead';

        const changePct = histAvg > 0 ? ((forecastAvg - histAvg) / histAvg * 100) : 0;
        document.getElementById('resultChangePct').textContent = (changePct >= 0 ? '+' : '') + changePct.toFixed(1) + '%';
        document.getElementById('resultChangeDesc').textContent = `Forecast avg ${forecastAvg.toFixed(0)} vs hist ${histAvg.toFixed(0)}`;

        const peakIdx = best.forecast.indexOf(Math.max(...best.forecast));
        const lowIdx = best.forecast.indexOf(Math.min(...best.forecast));
        const lastDate = dates[dates.length - 1];
        document.getElementById('peakForecast').textContent = Math.max(...best.forecast).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        document.getElementById('peakDate').textContent = Utils.formatDate(Utils.nextDate(lastDate, App.state.frequency, peakIdx + 1));
        document.getElementById('lowForecast').textContent = Math.min(...best.forecast).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        document.getElementById('lowDate').textContent = Utils.formatDate(Utils.nextDate(lastDate, App.state.frequency, lowIdx + 1));

        const insights = [];
        if (changePct > 1) insights.push(`Volume is forecasted to <strong>increase by ${changePct.toFixed(1)}%</strong> over the next ${horizon} months.`);
        else if (changePct < -1) insights.push(`Volume is forecasted to <strong>decrease by ${Math.abs(changePct).toFixed(1)}%</strong> over the next ${horizon} months.`);
        else insights.push(`Volume is expected to remain <strong>relatively stable</strong> over the next ${horizon} months.`);
        if (season.detected) insights.push(`A recurring seasonal pattern was detected (seasonal strength ${season.strength}%).`);
        insights.push(`The <strong>${best.name}</strong> model produced the lowest validation RMSE (${best.rmse.toFixed(2)}).`);
        if (anomalies.count > 0) insights.push(`${anomalies.count} potential ${anomalies.count === 1 ? 'anomaly' : 'anomalies'} detected in the historical data.`);
        document.getElementById('insightsBody').innerHTML = '<ul class="insights-list">' + insights.map(i => '<li>' + i + '</li>').join('') + '</ul>';

        const select = document.getElementById('resultModelSelect');
        select.innerHTML = '<option value="">All Models</option>' + results.map(r => `<option value="${r.name}" ${r.name === best.name ? 'selected' : ''}>${r.name}</option>`).join('');

        const thead = document.getElementById('forecastHead');
        thead.innerHTML = '<tr><th>Date</th><th>Actual</th>' + results.map(r => `<th>${r.name}</th>`).join('') + '</tr>';
        const rows = [];
        for (let i = 0; i < dates.length; i++) {
            const row = [Utils.formatDate(dates[i]), vals[i]];
            results.forEach(r => row.push(r.fitted[i] !== null ? r.fitted[i].toFixed(2) : ''));
            rows.push(row);
        }
        for (let i = 1; i <= horizon; i++) {
            const d = Utils.formatDate(Utils.nextDate(lastDate, App.state.frequency, i));
            const row = [d, ''];
            results.forEach(r => row.push(r.forecast[i - 1].toFixed(2)));
            rows.push(row);
        }
        document.getElementById('forecastBody').innerHTML = rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('');

        this.updateForecastChart(select.value);
    },

    updateForecastChart(selectedModel) {
        const results = this.state.forecastResults;
        if (!results.length) return;
        try {
            Charts.renderForecastChart('forecastChart', this.state.dates.map(d => Utils.formatDate(d)), this.state.values, results, selectedModel || null);
        } catch (e) { console.warn(e); }
    },

    exportCsv() {
        const results = this.state.forecastResults;
        if (!results.length) return;
        let csv = 'Date,Actual,' + results.map(r => '"' + r.name + '"').join(',') + '\n';
        for (let i = 0; i < this.state.dates.length; i++) {
            csv += Utils.formatDate(this.state.dates[i]) + ',' + this.state.values[i];
            results.forEach(r => csv += ',' + (r.fitted[i] !== null ? r.fitted[i].toFixed(4) : ''));
            csv += '\n';
        }
        const lastDate = this.state.dates[this.state.dates.length - 1];
        for (let i = 1; i <= results[0].forecast.length; i++) {
            csv += Utils.formatDate(Utils.nextDate(lastDate, App.state.frequency, i)) + ',';
            results.forEach(r => csv += ',' + r.forecast[i - 1].toFixed(4));
            csv += '\n';
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forecast_results.csv'; a.click();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
