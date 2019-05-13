const project = require('../lib/project');

module.exports = app => project(
  app.args.shift(),
  app.opts,
);


module.exports.args = [
  { name: 'path', required: true },
];

module.exports.options = [
  { name: 'repository', required: true },
  { name: 'version', required: true },
  { name: 'locale', required: true },
  { name: 'track', required: true },
  { name: 'rubric', required: true },
  { name: 'commit', required: true },
  { name: 'branch', required: true },
  { name: 'userName', required: true },
  { name: 'accessToken', required: true },
];
