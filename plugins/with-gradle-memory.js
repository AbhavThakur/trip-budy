// Release builds (R8) run out of Gradle metaspace with the default 512m — keep this across `expo prebuild`.
const { withGradleProperties } = require('expo/config-plugins');

module.exports = (config) =>
  withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === 'org.gradle.jvmargs'));
    c.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx4096m -XX:MaxMetaspaceSize=1536m' });
    return c;
  });
