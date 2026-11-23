// Metro, as Expo sets it up, plus one thing: 'react-router-dom' answered by
// @xeplr/ui-factory/native's stand-in. A phone has no URL — the screens keep
// their state in memory without a router — and react-router's own code does
// not compile for Hermes.
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
const noRouter = require.resolve('@xeplr/ui-factory/native/noRouter')
const resolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, name, platform) => {
  if (name === 'react-router-dom') return { type: 'sourceFile', filePath: noRouter }
  return resolveRequest ? resolveRequest(context, name, platform) : context.resolveRequest(context, name, platform)
}
module.exports = config
