import { createCanvas, registerFont } from 'canvas';

const width = 1024 + 256;
const height = 512 + 256;
const margin = 128;
const titleTextSize = 35;

const lineWidth = 16;
const yAxisThickness = 2;

const colors = {
	bg: '#434343',
	text: '#e0e4cc',
	yAxis: '#5a5a5a',
	dataset: [
		'#ff4e50',
		'#c2f725',
		'#69d2e7',
		'#f38630',
		'#f9d423',
	]
};

const yAxisTicks = 4;

type Chart = {
	title?: string;
	datasets: {
		title?: string;
		data: number[];
	}[];
};

export function renderChart(chart: Chart) {
	registerFont('./font.ttf', { family: 'CustomFont' });

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');
	ctx.antialias = 'default';

	ctx.fillStyle = colors.bg;
	ctx.beginPath();
	ctx.fillRect(0, 0, width, height);

	let chartAreaX = margin;
	let chartAreaY = margin;
	let chartAreaWidth = width - (margin * 2);
	let chartAreaHeight = height - (margin * 2);

	// Draw title
	if (chart.title) {
		ctx.font = `${titleTextSize}px CustomFont`;
		const t = ctx.measureText(chart.title);
		ctx.fillStyle = colors.text;
		ctx.fillText(chart.title, (width / 2) - (t.width / 2), 128);

		chartAreaY += titleTextSize;
		chartAreaHeight -= titleTextSize;
	}

	const xAxisCount = chart.datasets[0].data.length;
	const serieses = chart.datasets.length;

	// データの範囲計算（積み上げ表示のため、各X位置での正側合計・負側合計で範囲を取る。0を必ず含める）
	let lowerBound = 0;
	let upperBound = 0;
	for (let xAxis = 0; xAxis < xAxisCount; xAxis++) {
		let positiveSum = 0;
		let negativeSum = 0;
		for (const dataset of chart.datasets) {
			const value = dataset.data[xAxis] ?? 0;
			if (value >= 0) positiveSum += value;
			else negativeSum += value;
		}
		upperBound = Math.max(upperBound, positiveSum);
		lowerBound = Math.min(lowerBound, negativeSum);
	}

	// Y軸のスケール計算
	const yAxisSteps = niceScale(lowerBound, upperBound, yAxisTicks);
	const yAxisStepsMin = yAxisSteps[0];
	const yAxisStepsMax = yAxisSteps[yAxisSteps.length - 1];
	// 全データが0のときの 0 除算（NaN/Infinity 座標で描画が壊れる）を防ぐ
	const yAxisRange = (yAxisStepsMax - yAxisStepsMin) || 1;

	// 0の位置をY軸上で計算
	const zeroY = chartAreaY + chartAreaHeight * (yAxisStepsMax / yAxisRange);

	// Y軸の描画
	ctx.lineWidth = yAxisThickness;
	ctx.lineCap = 'round';

	// 0の基準線を描画（より目立つ色で）
	ctx.strokeStyle = colors.text;
	ctx.beginPath();
	ctx.moveTo(chartAreaX, zeroY);
	ctx.lineTo(chartAreaX + chartAreaWidth, zeroY);
	ctx.stroke();

	// 他の目盛り線の描画
	ctx.strokeStyle = colors.yAxis;
	for (let i = 0; i < yAxisSteps.length; i++) {
		const step = yAxisSteps[i];
		const y = chartAreaY + chartAreaHeight * ((yAxisStepsMax - step) / yAxisRange);
			
		if (step !== 0) { // 0以外の目盛り線
			ctx.beginPath();
			ctx.moveTo(chartAreaX, y);
			ctx.lineTo(chartAreaX + chartAreaWidth, y);
			ctx.stroke();
		}

			// 目盛り値の描画
		ctx.font = '20px CustomFont';
		ctx.fillStyle = colors.text;
		ctx.fillText(step.toString(), chartAreaX - 40, y);
	}

	const perXAxisWidth = chartAreaWidth / xAxisCount;

	// データの描画（0基準線から正側・負側それぞれに積み上げる。
	// 重ね描きだと大きい series が小さい series を隠してしまう）
	ctx.lineWidth = lineWidth;
	ctx.lineCap = 'round';

	for (let xAxis = 0; xAxis < xAxisCount; xAxis++) {
		const x = chartAreaX + (perXAxisWidth * ((xAxisCount - 1) - xAxis)) + (perXAxisWidth / 2);

		let positiveOffset = 0;
		let negativeOffset = 0;

		for (let series = 0; series < serieses; series++) {
			ctx.strokeStyle = colors.dataset[series % colors.dataset.length];
			const originalValue = chart.datasets[series].data[xAxis] ?? 0;
			const barHeight = (Math.abs(originalValue) / yAxisRange) * chartAreaHeight;

			let y: number;
			let yEnd: number;
			if (originalValue >= 0) {
				yEnd = zeroY - positiveOffset;
				y = yEnd - barHeight;
				positiveOffset += barHeight;
			} else {
				y = zeroY + negativeOffset;
				yEnd = y + barHeight;
				negativeOffset += barHeight;
			}

			ctx.globalAlpha = 1 - (xAxis / xAxisCount);
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x, yEnd);
			ctx.stroke();
		}
	}

	// 透明度をリセット
	ctx.globalAlpha = 1;

	return canvas.toBuffer();
}

// https://stackoverflow.com/questions/326679/choosing-an-attractive-linear-scale-for-a-graphs-y-axis
// https://github.com/apexcharts/apexcharts.js/blob/master/src/modules/Scales.js
// This routine creates the Y axis values for a graph.
function niceScale(lowerBound: number, upperBound: number, ticks: number): number[] {
	if (lowerBound === 0 && upperBound === 0) return [0];

	// Calculate Min amd Max graphical labels and graph
	// increments.  The number of ticks defaults to
	// 10 which is the SUGGESTED value.  Any tick value
	// entered is used as a suggested value which is
	// adjusted to be a 'pretty' value.
	//
	// Output will be an array of the Y axis values that
	// encompass the Y values.
	const steps: number[] = [];

	// Determine Range
	const range = upperBound - lowerBound;

	let tiks = ticks + 1;
	// Adjust ticks if needed
	if (tiks < 2) {
		tiks = 2;
	} else if (tiks > 2) {
		tiks -= 2;
	}

	// Get raw step value
	const tempStep = range / tiks;

	// Calculate pretty step value
	const mag = Math.floor(Math.log10(tempStep));
	const magPow = Math.pow(10, mag);
	const magMsd = (parseInt as any)(tempStep / magPow);
	const stepSize = magMsd * magPow;

	// build Y label array.
	// Lower and upper bounds calculations
	const lb = stepSize * Math.floor(lowerBound / stepSize);
	const ub = stepSize * Math.ceil(upperBound / stepSize);
	// Build array
	let val = lb;
	while (1) {
		steps.push(val);
		val += stepSize;
		if (val > ub) {
			break;
		}
	}

	return steps;
}
