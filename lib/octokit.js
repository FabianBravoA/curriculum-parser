const Octokit = require('@octokit/rest');

module.exports = ({ auth }) => Octokit({
  auth,
  userAgent: 'Laboratoria/curriculum-parser',
});
