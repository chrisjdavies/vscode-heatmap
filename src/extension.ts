import { execSync } from 'child_process';
import path = require('path');
import * as vscode from 'vscode';

const DEFAULT_HEAT_COLOUR = '200,0,0';
const DEFAULT_HEAT_LEVELS = 10;

const heatStyles: vscode.TextEditorDecorationType[] = [];

var enabledForFiles = new Set();


function getGitTimestampsForLines(document: vscode.TextDocument): undefined | number[] {
	const filePath = document.uri.fsPath;
	const fileDir = path.dirname(filePath);
	const escapedFilePath = filePath.replace(/(["'$`\\])/g, '\\$1');
	const timestamps: number[] = new Array(document.lineCount);
	const hashCache: {[key: string]: number} = {};

	try {
		// TODO: Maybe use a better exec option to stream the output?
		const blameOutput = execSync(`git blame -p "${escapedFilePath}"`, { cwd: fileDir }).toString();
		const lines = blameOutput.split('\n');
		let currentHash: string = '0000000000000000000000000000000000000000';

		// 1. Collect the hash -> timestamps:
		for (let i = 0; i < lines.length; ++i) {
			const match = lines[i].match(/^([0-9a-f]{40}) \d+ \d+/);

			if (match) {
				currentHash = match[1];
			} else if (lines[i].startsWith('committer-time ')) {
				hashCache[currentHash] = parseInt(lines[i].split(' ')[1]);
			}
		}

		// 2. Map the lines:
		for (let i = 0; i < lines.length; ++i) {
			const match = lines[i].match(/^([0-9a-f]{40}) \d+ (\d+)/);
			if (match) {
				const line = parseInt(match[2]);
				timestamps[line - 1] = hashCache[match[1]];
			}
		}
	}
	catch (_) {
		return undefined;
	}

	return timestamps;
}

function updateVisibleHeatmaps(){
	vscode.window.visibleTextEditors.forEach(editor => {
		updateHeatmapForEditor(editor);
	});
}

function updateHeatmapForEditor(editor:vscode.TextEditor){
	// clear whatever was already there
	heatStyles.forEach(style => editor.setDecorations(style, []));

	// decide whether heatmap needs to be redrawn
	if (!enabledForFiles.has(editor.document.uri)){
		return;
	}

	// Create the buckets:
	const ranges: vscode.Range[][] = [];
	for (let i = 0; i < heatStyles.length; ++i) {
		ranges[i] = [];
	}

	// Bucket each line range by age:
	const document = editor.document;
	const lineTimes = getGitTimestampsForLines(document);
	if (lineTimes === undefined || lineTimes.length === 0) {
		return;
	}

	const minTime = lineTimes.reduce((a, b) => Math.min(a, b), lineTimes[0]);
	const maxTime = lineTimes.reduce((a, b) => Math.max(a, b), lineTimes[0]);
	const timeRange = maxTime - minTime;

	if (timeRange === 0) {
		return;
	}

	const timePerLevel = ((timeRange + heatStyles.length - 1) / heatStyles.length);

	for (let i = 0; i < document.lineCount; ++i) {
		const line = document.lineAt(i);
		const range = new vscode.Selection(line.range.start, line.range.end);
		const lineTime = lineTimes[i];

		if (lineTime === undefined) {
			continue;
		}

		const bucket = Math.floor((lineTime - minTime) / timePerLevel);

		ranges[bucket].push(range);
	}	

	// Apply the styles:
	for (let i = 0; i < heatStyles.length; ++i) {
		editor.setDecorations(heatStyles[i], ranges[i]);
	}
}

function setHeatmapEnabled(enable: boolean) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	if (enable){
		enabledForFiles.add(editor.document.uri);
	}
	else{
		enabledForFiles.delete(editor.document.uri);
	}

	updateVisibleHeatmaps();
}

function toggleHeatmap(){
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	if (enabledForFiles.has(editor.document.uri)){
		enabledForFiles.delete(editor.document.uri);
	}else{
		enabledForFiles.add(editor.document.uri);
	}

	updateVisibleHeatmaps();
}

export function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('heatmap');
	const heatLevels = config.get<number>('heatLevels') || DEFAULT_HEAT_LEVELS;
	const heatColour = config.get<string>('heatColour') || DEFAULT_HEAT_COLOUR;

	if (heatLevels < 1) {
		vscode.window.showErrorMessage('Heatmap: Invalid number of heat levels (must be >1).');
		return;
	}

	let heatPerLevel = heatLevels > 1 ? (1.0 / (heatLevels - 1)) : 0;

	for (let i = 0; i < heatLevels; ++i) {
		heatStyles.push(vscode.window.createTextEditorDecorationType({
			backgroundColor: 'rgba(' + heatColour + ', ' + (heatPerLevel * i) + ')',
		}));
	}

	let commands = [
		vscode.commands.registerCommand('heatmap.enable', () => { setHeatmapEnabled(true); }),
		vscode.commands.registerCommand('heatmap.disable', () => { setHeatmapEnabled(false); }),
		vscode.commands.registerCommand('heatmap.toggle', () => { toggleHeatmap(); })
	];

	commands.forEach(cmd => context.subscriptions.push(cmd));

	vscode.window.onDidChangeVisibleTextEditors(_ => {
        updateVisibleHeatmaps();
    }, null, context.subscriptions)
}

export function deactivate() {}
