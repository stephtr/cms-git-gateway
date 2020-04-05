const webpackConfig = require('./webpack.config.js');

module.exports = {
	...webpackConfig,
	entry: {
		index: './index.ts',
		netlify: 'netlify-cms',
	},
	mode: 'development',
	devtool: 'inline-source-map',
	devServer: {
		contentBase: './example',
		hot: true,
	},
};
