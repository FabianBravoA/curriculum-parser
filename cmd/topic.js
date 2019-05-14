const course = require('../lib/course');

module.exports = app => course(
  app.args.shift(),
  app.opts,
);


module.exports.args = [
  { name: 'dir', required: true },
];

module.exports.options = [
  { name: 'repository', required: true },
  { name: 'version', required: true },
  { name: 'locale', required: true },
  { name: 'track', required: true },
  { name: 'suffix', required: false },
  { name: 'commit', required: true },
  { name: 'branch', required: true },
  { name: 'userName', required: true },
  { name: 'accessToken', required: true },
];
