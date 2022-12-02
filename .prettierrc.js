module.exports = {
  arrowParens: 'avoid',
  bracketSpacing: true,
  endOfLine: 'auto',
  printWidth: 120,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  plugins: ['./node_modules/prettier-plugin-packagejson', './node_modules/prettier-plugin-solidity'],
  overrides: [
    {
      files: '*.sol',
      options: {
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        bracketSpacing: false,
        explicitTypes: 'always',
      },
    },
  ],
};
