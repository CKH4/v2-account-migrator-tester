import { fusebox, pluginReplace } from "fuse-box"

const fuse = fusebox({
	target: "browser",
	entry: "src/index.ts",
	webIndex: {
		template: "src/index.html",
	},
	devServer: {
		enabled: true,
		httpServer: {
			enabled: true,
			port: 4445
		}
	},
	sourceMap: true,
	hmr: false,
	plugins: [
		pluginReplace(/node_modules\/bn\.js\/.*/, {
			"require('buffer')": "require('" + require.resolve("./node_modules/buffer") + "')",
		}),
		pluginReplace(/node_modules\/hdkey\/.*/, {
			"require('crypto')": "require('" + require.resolve("./node_modules/crypto-browserify") + "')",
		}),
		pluginReplace(/node_modules\/readable-stream\/.*/, {
			"require('util')": "require('" + require.resolve("./node_modules/util") + "')",
		}),
		pluginReplace(/node_modules\/readable-stream\/.*/, {
			"require('stream')": "require('" + require.resolve("./node_modules/stream-browserify") + "')",
		})
	],
	watcher: {
		enabled: false,
		include: [
			"../",
		]
	}
})

fuse.runDev({
	bundles: {
		distRoot: "docs"
	}
})
