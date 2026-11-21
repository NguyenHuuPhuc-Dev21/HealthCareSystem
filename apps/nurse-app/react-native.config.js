const path = require('path');

let rnConfigAndroidDir;
try {
  rnConfigAndroidDir = path.join(path.dirname(require.resolve('react-native-config/package.json', { paths: [__dirname] })), 'android');
} catch (e) {
  rnConfigAndroidDir = path.resolve(__dirname, '../../node_modules/react-native-config/android');
}

module.exports = {
  dependencies: {
    'react-native-config': {
      platforms: {
        android: {
          sourceDir: rnConfigAndroidDir,
          packageImportPath: 'import com.lugg.RNCConfig.RNCConfigPackage;',
          packageInstance: 'new RNCConfigPackage()',
        },
      },
    },
  },
};
