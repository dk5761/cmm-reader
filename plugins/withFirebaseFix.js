const { withXcodeProject, IOSConfig } = require("@expo/config-plugins");

/**
 * Custom config plugin to fix non-modular header includes for react-native-firebase.
 * This adds CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES to build settings.
 */
const withFirebaseFix = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const buildConfigurations = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in buildConfigurations) {
      const buildConfig = buildConfigurations[key];
      if (buildConfig.buildSettings) {
        // Allow non-modular includes in framework modules
        buildConfig.buildSettings.CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = "YES";
      }
    }

    return config;
  });
};

module.exports = withFirebaseFix;
