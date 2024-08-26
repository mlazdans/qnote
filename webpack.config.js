const theMode = "none";
const path = require("path");
const outputPath = path.resolve(__dirname, "./dist/release/");

const tsLoaderRules = [
	{
		test: /\.tsx?$/,
		use: {
			loader: "ts-loader",
			options: {
				onlyCompileBundledFiles: true,
			}
		},
		// exclude: /node_modules/,
	},{
		test: /\.mts$/,
		use: "ts-loader",
		// resolve: {
		// 	fullySpecified: false
		// }
	}
];

const extensions = [".tsx", ".ts", ".js"];

module.exports = [
	// {
	// 	name: "webextension",
	// 	mode: theMode,
	// 	entry: {
	// 		background: "./src/background.ts",
	// 		// options: "./src/options/options.ts",
	// 		// popup: "./src/popup/popup.ts",
	// 	},
	// 	output: {
	// 		path: outputPath,
	// 	},
	// 	module: {
	// 		rules: tsLoaderRules,
	// 	},
	// 	resolve: {
	// 		extensions: extensions,
	// 		extensionAlias: {
	// 			".js": [".js", ".ts"],
	// 			".cjs": [".cjs", ".cts"],
	// 			".mjs": [".mjs", ".mts"]
	// 		}
	// 		// modules: ['.', 'node_modules']
	// 	},
	// },
	{
		name: "scripts",
		mode: theMode,
		entry: {
			qpopup: "./src/scripts/qpopup.ts",
		},
		output: {
			path: outputPath+ '/scripts/',
		},
		module: {
			rules: tsLoaderRules,
		},
		resolve: {
			extensions: extensions,
			extensionAlias: {
				".js": [".js", ".ts"],
				".cjs": [".cjs", ".cts"],
				".mjs": [".mjs", ".mts"]
			}
			// modules: ['.', 'node_modules']
		},
	},
	// {
	// 	name: "api",
	// 	mode: theMode,
	// 	entry: {
	// 		qpopup: "./src/api/qpopup.ts",
	// 	},
	// 	output: {
	// 		path: outputPath+ '/api/',
	// 	},
	// 	module: {
	// 		rules: tsLoaderRules,
	// 	},
	// 	resolve: {
	// 		extensions: extensions,
	// 		extensionAlias: {
	// 			".js": [".js", ".ts"],
	// 			".cjs": [".cjs", ".cts"],
	// 			".mjs": [".mjs", ".mts"]
	// 		}
	// 		// modules: ['.', 'node_modules']
	// 	},
	// },
	// {
	// 	name: "modules",
	// 	mode: theMode,
	// 	entry: {
	// 		QEventDispatcher: "./src/modules/QEventDispatcher.mts",
	// 	},
	// 	// output: {
	// 	// 	path: outputPath + '/modules/',
	// 	// },
	// 	output: {
	// 		library: {
	// 			name: "QEventDispatcher",
	// 			type: 'amd',
	// 		},
	// 		path: outputPath + '/modules/',
	// 	},
	// 	module: {
	// 		rules: tsLoaderRules,
	// 	},
	// 	resolve: {
	// 		extensions: extensions,
	// 		extensionAlias: {
	// 			".js": [".js", ".ts"],
	// 			".cjs": [".cjs", ".cts"],
	// 			".mjs": [".mjs", ".mts"]
	// 		}
	// 		// modules: ['.', 'node_modules']
	// 	},
	// 	// externals: {
	// 	// 	'webpackVariables': `{
	// 	// 		serverUrl: 'test',
	// 	// 	}`,
	// 	// },
	// 	plugins: [
	// 		/**
	// 		 * Plugin that appends "this.EXPORTED_SYMBOLS = ["libname"]" to assets
	// 		 * output by webpack. This allows built assets to be imported using
	// 		 * Cu.import.
	// 		 */
	// 		// function ExportedSymbols(compiler) {
	// 		// 	console.log(compiler);
	// 		// 	// this.plugin("emit", function(compilation, callback) {
	// 		// 	// 	for (const libraryName in compilation.entrypoints) {
	// 		// 	// 	const assetName = `${libraryName}.js`; // Matches output.filename
	// 		// 	// 	compilation.assets[assetName] = new ConcatSource(
	// 		// 	// 		"/* eslint-disable */", // Disable linting
	// 		// 	// 		compilation.assets[assetName],
	// 		// 	// 		`this.EXPORTED_SYMBOLS = ["${libraryName}"];` // Matches output.library
	// 		// 	// 	);
	// 		// 	// 	}
	// 		// 	// 	callback();
	// 		// 	// });
	// 		// },
	// 	],
	// }
];
