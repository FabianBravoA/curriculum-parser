const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const Octokit = require('./octokit');
const { isDirname } = require('./common');
const part = require('./part');


module.exports = async (dirOrPath, opts = {}) => {
  if (opts.branch && opts.token) {
    const { repo, token, branch } = opts;
    const [username, repository] = repo.split('/');
    const octokit = Octokit({
      auth: token,
    });
    const { data } = await octokit.repos.getContents({
      owner: username,
      repo: repository,
      path: dirOrPath,
      ref: branch,
    });
    const partDirs = data.filter(file => file.type === 'dir');
    const parts = await Promise.all(partDirs.map(partDir => part(partDir.path, opts)));
    return parts.reduce((memo, item, idx) => ({
      ...memo,
      [partDirs[idx].name]: item,
    }), {});
  }

  const dir = path.resolve(dirOrPath);
  return promisify(fs.readdir)(dir)
    .then(files => files.filter(isDirname))
    .then(
      partDirs => Promise.all(
        partDirs.map(partDir => part(path.join(dirOrPath, partDir), opts)),
      )
        .then(parts => parts.reduce(
          (memo, item, idx) => ({
            ...memo,
            [partDirs[idx]]: item,
          }),
          {},
        )),
    );
};
