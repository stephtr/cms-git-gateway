const webpackConfig = require('./webpack.config');

module.exports = {
	...webpackConfig,
	entry: {
		index: './index.ts',
		netlify: 'netlify-cms',
	},
	mode: 'development',
	devtool: 'inline-source-map',
	devServer: {
		static: {
			directory: './example',
		},
		hot: true,
	},
};
