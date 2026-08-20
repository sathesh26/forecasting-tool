const Utils = {
    mean(arr) {
        if (!arr.length) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    },

    std(arr) {
        const m = this.mean(arr);
        return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
    },

    min(arr) { return Math.min(...arr); },
    max(arr) { return Math.max(...arr); },
    sum(arr) { return arr.reduce((a, b) => a + b, 0); },

    percentile(arr, p) {
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = (p / 100) * (sorted.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return sorted[lo];
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    },

    mae(actual, predicted) {
        const n = Math.min(actual.length, predicted.length);
        if (n === 0) return Infinity;
        let sum = 0;
        for (let i = 0; i < n; i++) sum += Math.abs(actual[i] - predicted[i]);
        return sum / n;
    },

    rmse(actual, predicted) {
        const n = Math.min(actual.length, predicted.length);
        if (n === 0) return Infinity;
        let sum = 0;
        for (let i = 0; i < n; i++) sum += (actual[i] - predicted[i]) ** 2;
        return Math.sqrt(sum / n);
    },

    mape(actual, predicted) {
        const n = Math.min(actual.length, predicted.length);
        let sum = 0, count = 0;
        for (let i = 0; i < n; i++) {
            if (Math.abs(actual[i]) > 0.001) {
                sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
                count++;
            }
        }
        return count > 0 ? (sum / count) * 100 : 0;
    },

    r2(actual, predicted) {
        const n = Math.min(actual.length, predicted.length);
        const a = actual.slice(0, n);
        const p = predicted.slice(0, n);
        const mA = this.mean(a);
        let ssRes = 0, ssTot = 0;
        for (let i = 0; i < n; i++) {
            ssRes += (a[i] - p[i]) ** 2;
            ssTot += (a[i] - mA) ** 2;
        }
        return ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
    },

    detectFrequency(dates) {
        if (dates.length < 2) return 'M';
        const diffs = [];
        for (let i = 1; i < Math.min(dates.length, 10); i++) {
            const d1 = new Date(dates[i - 1]);
            const d2 = new Date(dates[i]);
            diffs.push((d2 - d1) / (1000 * 60 * 60 * 24));
        }
        const avgDiff = this.mean(diffs);
        if (avgDiff <= 1.5) return 'D';
        if (avgDiff <= 8) return 'W';
        if (avgDiff <= 35) return 'M';
        if (avgDiff <= 100) return 'Q';
        return 'Y';
    },

    detectTrend(values) {
        if (values.length < 3) return { direction: 'Flat', strength: 0, slope: 0 };
        const n = values.length;
        const x = values.map((_, i) => i);
        const xM = this.mean(x);
        const yM = this.mean(values);
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
            num += (x[i] - xM) * (values[i] - yM);
            den += (x[i] - xM) ** 2;
        }
        const slope = den === 0 ? 0 : num / den;
        const fitted = x.map(xi => yM + slope * (xi - xM));
        const r = this.r2(values, fitted);
        const direction = slope > 0.5 ? 'Upward' : slope < -0.5 ? 'Downward' : 'Flat';
        return { direction, strength: Math.abs(r), slope };
    },

    detectSeasonality(values, sp) {
        if (values.length < sp * 2 || sp < 2) return { detected: false, period: 0, strength: 0 };
        let sumSqDiff = 0;
        const overallMean = this.mean(values);
        for (let i = 0; i < values.length; i++) sumSqDiff += (values[i] - overallMean) ** 2;
        const overallVar = sumSqDiff / values.length;

        const seasonalMeans = new Array(sp).fill(0);
        const seasonalCounts = new Array(sp).fill(0);
        for (let i = 0; i < values.length; i++) {
            const idx = i % sp;
            seasonalMeans[idx] += values[i];
            seasonalCounts[idx]++;
        }
        for (let i = 0; i < sp; i++) seasonalMeans[i] /= Math.max(seasonalCounts[i], 1);

        let seasonalVar = 0;
        for (let i = 0; i < values.length; i++) {
            const idx = i % sp;
            seasonalVar += (values[i] - seasonalMeans[idx]) ** 2;
        }
        seasonalVar /= values.length;

        const strength = overallVar > 0 ? Math.max(0, 1 - seasonalVar / overallVar) : 0;
        return { detected: strength > 0.15, period: sp, strength: Math.round(strength * 100) };
    },

    detectAnomalies(values) {
        if (values.length < 4) return { count: 0, indices: [] };
        const q1 = this.percentile(values, 25);
        const q3 = this.percentile(values, 75);
        const iqr = q3 - q1;
        const lower = q1 - 2.0 * iqr;
        const upper = q3 + 2.0 * iqr;
        const indices = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i] < lower || values[i] > upper) indices.push(i);
        }
        return { count: indices.length, indices };
    },

    dataQuality(values) {
        let score = 100;
        const missing = values.filter(v => v === null || v === undefined || isNaN(v)).length;
        score -= missing * 5;
        const anomalies = this.detectAnomalies(values);
        score -= anomalies.count * 3;
        if (values.length < 12) score -= (12 - values.length) * 2;
        const diffs = [];
        for (let i = 1; i < values.length; i++) diffs.push(Math.abs(values[i] - values[i - 1]));
        const avgDiff = this.mean(diffs);
        if (avgDiff > 0) {
            const cv = this.std(diffs) / avgDiff;
            if (cv > 2) score -= 10;
        }
        return Math.max(0, Math.min(100, Math.round(score)));
    },

    parseDate(str) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d;
        const parts = str.split(/[/\-\.]/);
        if (parts.length === 3) {
            const [a, b, c] = parts.map(Number);
            if (a > 12) return new Date(c, b - 1, a);
            if (c > 0 && c < 100) return new Date(2000 + c, a - 1, b);
            return new Date(c, a - 1, b);
        }
        return null;
    },

    addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; },
    addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; },

    formatDate(date) {
        const d = new Date(date);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    nextDate(lastDate, freq, i) {
        const d = new Date(lastDate);
        switch (freq) {
            case 'D': return this.addDays(d, i);
            case 'W': return this.addDays(d, i * 7);
            case 'M': return this.addMonths(d, i);
            case 'Q': return this.addMonths(d, i * 3);
            case 'Y': return new Date(d.getFullYear() + i, d.getMonth(), d.getDate());
            default: return this.addMonths(d, i);
        }
    }
};
