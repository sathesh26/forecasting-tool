const Models = {
    naive(data, horizon) {
        const fitted = new Array(data.length).fill(null);
        fitted[0] = data[0];
        for (let i = 1; i < data.length; i++) fitted[i] = data[i - 1];
        const last = data[data.length - 1];
        return { name: 'Naive Forecast', fitted, forecast: new Array(horizon).fill(last) };
    },

    seasonalNaive(data, horizon, sp) {
        sp = sp || 12;
        const fitted = new Array(data.length).fill(null);
        for (let i = 0; i < data.length; i++) {
            const pi = i - sp;
            fitted[i] = pi >= 0 ? data[pi] : data[i];
        }
        const forecast = [];
        for (let i = 1; i <= horizon; i++) forecast.push(data[data.length - sp + ((i - 1) % sp)]);
        return { name: 'Seasonal Naive', fitted, forecast };
    },

    sma(data, horizon, period) {
        const ws = Math.max(3, Math.min(period || 12, 6));
        const fitted = new Array(data.length).fill(null);
        for (let i = ws; i < data.length; i++) {
            let s = 0; for (let j = i - ws; j < i; j++) s += data[j];
            fitted[i] = s / ws;
        }
        const fw = data.slice(-ws).slice();
        const forecast = [];
        for (let i = 0; i < horizon; i++) { const avg = Utils.mean(fw); forecast.push(avg); fw.shift(); fw.push(avg); }
        return { name: 'Moving Average', fitted, forecast };
    },

    wma(data, horizon, period) {
        const ws = Math.max(3, Math.min(period || 12, 6));
        const fitted = new Array(data.length).fill(null);
        let wSum = 0; for (let i = 1; i <= ws; i++) wSum += i;
        for (let i = ws; i < data.length; i++) {
            let s = 0; for (let j = 0; j < ws; j++) s += data[i - ws + j] * (j + 1);
            fitted[i] = s / wSum;
        }
        const forecast = [];
        const fw2 = data.slice(-ws).slice();
        for (let i = 0; i < horizon; i++) {
            let s = 0; for (let j = 0; j < ws; j++) s += fw2[j] * (j + 1);
            const val = s / wSum; forecast.push(val);
            fw2.shift(); fw2.push(val);
        }
        return { name: 'Weighted Moving Average', fitted, forecast };
    },

    ses(data, horizon) {
        let bestA = 0.3, bestSSE = Infinity, bestLevel = data[0], bestFitted = [data[0]];
        for (let a = 0.05; a <= 0.95; a += 0.05) {
            let level = data[0]; const fitted = [level];
            for (let i = 1; i < data.length; i++) { fitted.push(level); level = a * data[i] + (1 - a) * level; }
            let sse = 0; for (let i = 1; i < data.length; i++) sse += (data[i] - fitted[i]) ** 2;
            if (sse < bestSSE) { bestSSE = sse; bestA = a; bestLevel = level; bestFitted = fitted.slice(); }
        }
        return { name: 'Simple Exponential Smoothing', fitted: bestFitted, forecast: new Array(horizon).fill(bestLevel) };
    },

    holtLinear(data, horizon) {
        let bestSSE = Infinity, bestL = data[0], bestT = 0, bestFitted = [data[0]];
        for (let a = 0.1; a <= 0.9; a += 0.1) {
            for (let b = 0.05; b <= 0.6; b += 0.05) {
                let L = data[0], T = data.length > 1 ? data[1] - data[0] : 0; const fitted = [L];
                for (let i = 1; i < data.length; i++) {
                    fitted.push(L + T);
                    const pL = L; L = a * data[i] + (1 - a) * (pL + T); T = b * (L - pL) + (1 - b) * T;
                }
                let sse = 0; for (let i = 1; i < data.length; i++) sse += (data[i] - fitted[i]) ** 2;
                if (sse < bestSSE) { bestSSE = sse; bestL = L; bestT = T; bestFitted = fitted.slice(); }
            }
        }
        const forecast = []; for (let i = 1; i <= horizon; i++) forecast.push(bestL + bestT * i);
        return { name: "Holt's Linear Trend", fitted: bestFitted, forecast };
    },

    holtWinters(data, horizon, sp) {
        sp = sp || 12;
        const n = data.length;
        if (n < sp * 2) return this.holtLinear(data, horizon);
        let bestSSE = Infinity, bestState = null;
        for (const a of [0.1, 0.3, 0.5]) {
            for (const b of [0.05, 0.2]) {
                for (const g of [0.1, 0.3]) {
                    let L = Utils.mean(data.slice(0, sp)), T = (Utils.mean(data.slice(sp, 2 * sp)) - Utils.mean(data.slice(0, sp))) / sp;
                    const S = []; for (let i = 0; i < sp; i++) S.push(data[i] - L);
                    const fitted = new Array(n).fill(0);
                    for (let i = 0; i < sp; i++) fitted[i] = L + T + S[i];
                    for (let i = sp; i < n; i++) {
                        const sPrev = S[i % sp]; fitted[i] = L + T + sPrev;
                        const pL = L; L = a * (data[i] - sPrev) + (1 - a) * (pL + T); T = b * (L - pL) + (1 - b) * T; S[i % sp] = g * (data[i] - L) + (1 - g) * sPrev;
                    }
                    let sse = 0; for (let i = sp; i < n; i++) sse += (data[i] - fitted[i]) ** 2;
                    if (sse < bestSSE) { bestSSE = sse; bestState = { L, T, S: [...S], fitted: fitted.slice() }; }
                }
            }
        }
        const { L, T, S, fitted } = bestState;
        const forecast = []; for (let i = 1; i <= horizon; i++) forecast.push(L + T * i + S[(n + i - 1) % sp]);
        return { name: 'Holt-Winters Additive', fitted, forecast };
    },

    holtWintersMult(data, horizon, sp) {
        sp = sp || 12;
        const n = data.length;
        if (n < sp * 2 || data.some(v => v <= 0)) return this.holtWinters(data, horizon, sp);
        let bestSSE = Infinity, bestState = null;
        for (const a of [0.1, 0.3, 0.5]) {
            for (const b of [0.05, 0.2]) {
                for (const g of [0.1, 0.3]) {
                    let L = Utils.mean(data.slice(0, sp)), T = (Utils.mean(data.slice(sp, 2 * sp)) - Utils.mean(data.slice(0, sp))) / sp;
                    const S = []; for (let i = 0; i < sp; i++) S.push(L > 0 ? data[i] / L : 1);
                    const fitted = new Array(n).fill(0);
                    for (let i = 0; i < sp; i++) fitted[i] = (L + T) * S[i];
                    for (let i = sp; i < n; i++) {
                        const sPrev = S[i % sp]; fitted[i] = (L + T) * sPrev;
                        const pL = L; L = a * (data[i] / Math.max(sPrev, 0.001)) + (1 - a) * (pL + T); T = b * (L - pL) + (1 - b) * T; S[i % sp] = g * (data[i] / Math.max(L, 0.001)) + (1 - g) * sPrev;
                    }
                    let sse = 0; for (let i = sp; i < n; i++) sse += (data[i] - fitted[i]) ** 2;
                    if (sse < bestSSE) { bestSSE = sse; bestState = { L, T, S: [...S], fitted: fitted.slice() }; }
                }
            }
        }
        const { L, T, S, fitted } = bestState;
        const forecast = []; for (let i = 1; i <= horizon; i++) forecast.push((L + T * i) * S[(n + i - 1) % sp]);
        return { name: 'Holt-Winters Multiplicative', fitted, forecast };
    },

    linearRegression(data, horizon) {
        const n = data.length;
        const xMean = (n - 1) / 2, yMean = Utils.mean(data);
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) { num += (i - xMean) * (data[i] - yMean); den += (i - xMean) ** 2; }
        const slope = den === 0 ? 0 : num / den;
        const intercept = yMean - slope * xMean;
        const fitted = data.map((_, i) => intercept + slope * i);
        const forecast = []; for (let i = 1; i <= horizon; i++) forecast.push(intercept + slope * (n - 1 + i));
        return { name: 'Linear Regression', fitted, forecast };
    },

    polyRegression(data, horizon) {
        const n = data.length;
        const x = data.map((_, i) => i);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        const sumX3 = x.reduce((a, b) => a + b * b * b, 0);
        const sumX4 = x.reduce((a, b) => a + b ** 4, 0);
        const sumY = data.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * data[i], 0);
        const sumX2Y = x.reduce((a, b, i) => a + b * b * data[i], 0);
        const det = n * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX3 - sumX2 * sumX2);
        if (Math.abs(det) < 1e-10) return this.linearRegression(data, horizon);
        const a0 = (sumY * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumXY * sumX4 - sumX3 * sumX2Y) + sumX2 * (sumXY * sumX3 - sumX2 * sumX2Y)) / det;
        const a1 = (n * (sumXY * sumX4 - sumX3 * sumX2Y) - sumY * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX2Y - sumXY * sumX2)) / det;
        const a2 = (n * (sumX2 * sumX2Y - sumXY * sumX3) - sumX * (sumX * sumX2Y - sumXY * sumX2) + sumY * (sumX * sumX3 - sumX2 * sumX2)) / det;
        const fitted = x.map(xi => a0 + a1 * xi + a2 * xi * xi);
        const forecast = []; for (let i = 1; i <= horizon; i++) { const xi = n - 1 + i; forecast.push(a0 + a1 * xi + a2 * xi * xi); }
        return { name: 'Polynomial Regression', fitted, forecast };
    },

    _ols(xArr, yArr) {
        const n = xArr.length, xM = Utils.mean(xArr), yM = Utils.mean(yArr);
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) { num += (xArr[i] - xM) * (yArr[i] - yM); den += (xArr[i] - xM) ** 2; }
        const slope = den === 0 ? 0 : num / den;
        const intercept = yM - slope * xM;
        return { slope, intercept, predict: (x) => intercept + slope * x };
    },

    _sigma(actual, fitted) {
        let ss = 0, c = 0;
        for (let i = 0; i < Math.min(actual.length, fitted.length); i++) { ss += (actual[i] - fitted[i]) ** 2; c++; }
        return c > 0 ? Math.sqrt(ss / c) || 1e-6 : 1e-6;
    },

    _gaussSolve(A, b) {
        const n = b.length;
        const aug = A.map((row, i) => [...row, b[i]]);
        for (let i = 0; i < n; i++) {
            let maxR = i;
            for (let r = i + 1; r < n; r++) if (Math.abs(aug[r][i]) > Math.abs(aug[maxR][i])) maxR = r;
            [aug[i], aug[maxR]] = [aug[maxR], aug[i]];
            const pivot = aug[i][i];
            if (Math.abs(pivot) < 1e-12) continue;
            for (let j = 0; j < n; j++) {
                if (j === i) continue;
                const f = aug[j][i] / pivot;
                for (let k = i; k <= n; k++) aug[j][k] -= f * aug[i][k];
            }
        }
        return aug.map((row, i) => Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]);
    },

    _arEstimate(diff, p) {
        const n = diff.length;
        const X = [], y = [];
        for (let i = p; i < n; i++) {
            const row = [1]; for (let j = 0; j < p; j++) row.push(diff[i - j - 1]);
            X.push(row); y.push(diff[i]);
        }
        const XtX = Array.from({ length: p + 1 }, () => Array(p + 1).fill(0));
        const Xty = Array(p + 1).fill(0);
        for (let i = 0; i < X.length; i++) {
            for (let r = 0; r < p + 1; r++) {
                Xty[r] += X[i][r] * y[i];
                for (let c = 0; c < p + 1; c++) XtX[r][c] += X[i][r] * X[i][c];
            }
        }
        const coeffs = this._gaussSolve(XtX, Xty);
        return { intercept: coeffs[0], arCoeffs: coeffs.slice(1) };
    },

    arima(data, horizon) {
        const diff = [];
        for (let i = 1; i < data.length; i++) diff.push(data[i] - data[i - 1]);
        const p = Math.min(2, Math.max(1, diff.length - 2));
        const { intercept, arCoeffs } = this._arEstimate(diff, p);
        const diffFc = [...diff];
        let level = data[data.length - 1];
        const forecast = [];
        for (let i = 0; i < horizon; i++) {
            let pred = intercept;
            for (let j = 0; j < arCoeffs.length; j++) pred += arCoeffs[j] * diffFc[diffFc.length - j - 1];
            diffFc.push(pred);
            level += pred;
            forecast.push(level);
        }
        return { name: 'ARIMA', fitted: new Array(data.length).fill(null), forecast };
    },

    sarima(data, horizon, sp) {
        sp = sp || 12;
        const n = data.length;
        if (n < sp * 2 + 4) return this.arima(data, horizon);
        const seasonDiff = [];
        for (let i = sp; i < n; i++) seasonDiff.push(data[i] - data[i - sp]);
        const p = Math.min(2, Math.max(1, seasonDiff.length - 2));
        const { intercept, arCoeffs } = this._arEstimate(seasonDiff, p);
        const sdFc = [...seasonDiff];
        const levels = [...data];
        const forecast = [];
        for (let i = 0; i < horizon; i++) {
            let pred = intercept;
            for (let j = 0; j < arCoeffs.length; j++) pred += arCoeffs[j] * sdFc[sdFc.length - j - 1];
            sdFc.push(pred);
            const val = levels[levels.length - sp] + pred;
            levels.push(val);
            forecast.push(val);
        }
        return { name: 'SARIMA', fitted: new Array(n).fill(null), forecast };
    },

    ets(data, horizon, sp, hasTrend, hasSeasonality) {
        sp = sp || 12;
        if (hasSeasonality && data.length >= 2 * sp) {
            const r = this.holtWinters(data, horizon, sp);
            return { name: 'ETS', fitted: r.fitted, forecast: r.forecast };
        }
        if (hasTrend) {
            const r = this.holtLinear(data, horizon);
            return { name: 'ETS', fitted: r.fitted, forecast: r.forecast };
        }
        const r = this.ses(data, horizon);
        return { name: 'ETS', fitted: r.fitted, forecast: r.forecast };
    },

    prophet(data, horizon, sp, hasSeasonality) {
        sp = sp || 12;
        const n = data.length;
        const xArr = data.map((_, i) => i);
        const trend = this._ols(xArr, data);
        const detrended = data.map((v, i) => v - trend.predict(i));
        const seasonal = new Array(sp).fill(0);
        const counts = new Array(sp).fill(0);
        if (hasSeasonality && sp >= 2) {
            for (let i = 0; i < n; i++) { seasonal[i % sp] += detrended[i]; counts[i % sp]++; }
            for (let i = 0; i < sp; i++) seasonal[i] /= Math.max(counts[i], 1);
            const m = Utils.mean(seasonal);
            for (let i = 0; i < sp; i++) seasonal[i] -= m;
        }
        const fitted = data.map((_, i) => trend.predict(i) + (hasSeasonality ? seasonal[i % sp] : 0));
        const forecast = [];
        for (let i = 0; i < horizon; i++) {
            const idx = n + i;
            forecast.push(trend.predict(idx) + (hasSeasonality ? seasonal[idx % sp] : 0));
        }
        return { name: 'Prophet-style Decomposition', fitted, forecast };
    },

    theta(data, horizon) {
        const n = data.length;
        const xArr = data.map((_, i) => i);
        const trend = this._ols(xArr, data);
        const ses = this.ses(data, 1);
        const sesLevel = ses.forecast[0];
        const slope = trend.slope;
        const fitted = xArr.map(i => 0.5 * trend.predict(i) + 0.5 * sesLevel);
        const forecast = [];
        for (let i = 1; i <= horizon; i++) {
            const trendLine = trend.predict(n + i - 1);
            const sesLine = sesLevel + slope * i * 0.5;
            forecast.push(0.5 * trendLine + 0.5 * sesLine);
        }
        return { name: 'Theta Method', fitted, forecast };
    },

    runAll(data, config) {
        const { horizon, seasonalPeriod, models, hasTrend, hasSeasonality } = config;
        const sp = seasonalPeriod || 12;
        const r = [];
        if (models.naive) r.push(this.naive(data, horizon));
        if (models.seasonal_naive) r.push(this.seasonalNaive(data, horizon, sp));
        if (models.moving_average) r.push(this.sma(data, horizon, sp));
        if (models.weighted_ma) r.push(this.wma(data, horizon, sp));
        if (models.ses) r.push(this.ses(data, horizon));
        if (models.holt) r.push(this.holtLinear(data, horizon));
        if (models.hw_add) r.push(this.holtWinters(data, horizon, sp));
        if (models.hw_mult) r.push(this.holtWintersMult(data, horizon, sp));
        if (models.linear_reg) r.push(this.linearRegression(data, horizon));
        if (models.poly_reg) r.push(this.polyRegression(data, horizon));
        if (models.arima) r.push(this.arima(data, horizon));
        if (models.sarima) r.push(this.sarima(data, horizon, sp));
        if (models.ets) r.push(this.ets(data, horizon, sp, hasTrend, hasSeasonality));
        if (models.prophet) r.push(this.prophet(data, horizon, sp, hasSeasonality));
        if (models.theta) r.push(this.theta(data, horizon));
        return r;
    }
};
