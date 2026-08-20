const DataLoader = {
    parseCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete(results) {
                    if (results.errors.length) console.warn('CSV parse warnings:', results.errors);
                    resolve(results.data);
                },
                error(err) { reject(err); }
            });
        });
    },

    parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const data = XLSX.utils.sheet_to_json(sheet);
                    resolve(data);
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    async loadFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'csv' || ext === 'txt') return this.parseCSV(file);
        if (ext === 'xlsx' || ext === 'xls') return this.parseExcel(file);
        throw new Error('Unsupported file type: ' + ext);
    },

    getColumns(data) {
        if (!data.length) return [];
        return Object.keys(data[0]);
    },

    detectDateColumn(columns, data) {
        const dateKeywords = ['date', 'time', 'month', 'year', 'week', 'day', 'period', 'timestamp'];
        for (const col of columns) {
            if (dateKeywords.some(k => col.toLowerCase().includes(k))) {
                const sample = data.slice(0, 5).map(r => r[col]);
                if (sample.every(v => !isNaN(new Date(v).getTime()))) return col;
            }
        }
        for (const col of columns) {
            const sample = data.slice(0, 5).map(r => r[col]);
            if (sample.every(v => !isNaN(new Date(String(v)).getTime()))) return col;
        }
        return columns[0];
    },

    detectValueColumn(columns, data) {
        for (const col of columns) {
            const vals = data.slice(0, 10).map(r => r[col]);
            if (vals.every(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))))) return col;
        }
        return columns[columns.length - 1];
    },

    extractSeries(data, dateCol, valueCol) {
        const dates = [];
        const values = [];
        for (const row of data) {
            const d = Utils.parseDate(String(row[dateCol]));
            const v = Number(row[valueCol]);
            if (d && !isNaN(v)) {
                dates.push(d);
                values.push(v);
            }
        }
        const sorted = dates.map((d, i) => ({ d, v: values[i] }))
            .sort((a, b) => a.d - b.d);
        return {
            dates: sorted.map(s => s.d),
            values: sorted.map(s => s.v)
        };
    },

    getStats(values) {
        return {
            count: values.length,
            mean: Utils.mean(values).toFixed(2),
            std: Utils.std(values).toFixed(2),
            min: Utils.min(values).toFixed(2),
            max: Utils.max(values).toFixed(2),
            sum: Utils.sum(values).toFixed(2)
        };
    },

    generateSampleData() {
        const months = 36;
        const seasonalIdx = [0.92, 0.90, 0.96, 1.00, 1.03, 1.05, 1.08, 1.06, 1.00, 1.04, 1.18, 1.28];
        const base = new Date();
        base.setDate(1);
        base.setMonth(base.getMonth() - (months - 1));
        const rows = [];
        for (let l = 0; l < months; l++) {
            const d = new Date(base.getFullYear(), base.getMonth() + l, 1);
            const monthIdx = d.getMonth();
            const trend = 1 + 0.012 * l;
            const noise = 1 + (0.5 * Math.sin(2.3 * l) + 0.5 * Math.cos(1.7 * l)) * 0.04;
            const volume = Math.round(12000 * trend * seasonalIdx[monthIdx] * noise);
            const aht = Math.round((300 - 0.6 * l + 6 * Math.sin(l)) * 10) / 10;
            const fte = Math.round(volume * aht / 532440 * 10) / 10;
            const sales = Math.round(volume * (0.18 + 0.02 * Math.sin(0.9 * l)));
            const revenue = Math.round(sales * (145 + 8 * Math.cos(0.6 * l)));
            rows.push({ Date: Utils.formatDate(d), Volume: volume, AHT: aht, Required_FTE: fte, Sales: sales, Revenue: revenue });
        }
        return rows;
    },

    downloadSampleCSV() {
        const rows = this.generateSampleData();
        const cols = Object.keys(rows[0]);
        let csv = cols.join(',') + '\n';
        rows.forEach(r => { csv += cols.map(c => r[c]).join(',') + '\n'; });
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sample_forecast_data.csv'; a.click();
    },

    downloadSampleExcel() {
        const rows = this.generateSampleData();
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sample Data');
        XLSX.writeFile(wb, 'sample_forecast_data.xlsx');
    }
};
