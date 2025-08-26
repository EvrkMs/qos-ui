const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';
  
  return {
    mode: isDevelopment ? 'development' : 'production',
    entry: './src/index.jsx',
    target: 'electron-renderer',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html'
      })
    ],
    resolve: {
      extensions: ['.js', '.jsx']
    },
    devtool: isDevelopment ? 'source-map' : false
  };
};