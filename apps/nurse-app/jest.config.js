module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^react$': require.resolve('react'),
    '^react-native-svg$': '<rootDir>/__mocks__/react-native-svg.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|lucide-react-native|react-native-.*)/)',
  ],
};
