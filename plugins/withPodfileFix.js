const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to modify Podfile with a post_install hook fix.
 * This injects CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES
 * into the Pods project to resolve "non-modular header inside framework module" errors.
 */
const withPodfileFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      // Ensure Podfile exists (it should after prebuild, but good sanity check)
      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      // Avoid double-patching
      if (podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        return config;
      }

      // Inject $RNFirebaseAsStaticFramework = true at the top
      if (!podfileContent.includes('$RNFirebaseAsStaticFramework = true')) {
        podfileContent = `$RNFirebaseAsStaticFramework = true\n${podfileContent}`;
      }

      // The fix code block to inject
      const fixBlock = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

      // Inject at the start of the post_install block
      // This works by replacing the opening line of the block
      if (podfileContent.includes('post_install do |installer|')) {
        podfileContent = podfileContent.replace(
          'post_install do |installer|',
          `post_install do |installer|${fixBlock}`
        );
      } else {
        // Fallback: append a new post_install block if none exists (unlikely in Expo)
        podfileContent += `
post_install do |installer|
${fixBlock}
end
`;
      }

      fs.writeFileSync(podfilePath, podfileContent, 'utf8');
      return config;
    },
  ]);
};

module.exports = withPodfileFix;
