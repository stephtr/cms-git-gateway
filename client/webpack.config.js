module.exports = {
	mode: 'production',
	entry: {
		index: './index.ts',
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: 'ts-loader',
				exclude: /node_modules/,
			},
		],
	},
	resolve: {
		extensions: ['.js', '.ts'],
	},
};
