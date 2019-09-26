const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const Octokit = require('./octokit');
const { isDirname } = require('./common');
const unit = require('./unit');


//
// Read syllabus from filesystem or Github repository (not from main readme).
//
module.exports = async (dirOrPath, opts) => {
  if (opts.branch && opts.token) {
    const { repo, token, branch } = opts;
    const [username, repository] = repo.split('/');
    const octokit = Octokit({
      auth: token,
    });
    const { data } = await octokit.repos.getContents({
      owner: username,
      repo: repository,
      path: '',
      ref: branch,
    });
    const unitDirs = data.filter(file => file.type === 'dir');
    const units = await Promise.all(unitDirs.map(unitDir => unit(unitDir.path, opts)));
    return units.reduce((memo, item, idx) => ({
      ...memo,
      [unitDirs[idx].name]: item,
    }), {});
  }

  const dir = path.resolve(dirOrPath);
  return promisify(fs.readdir)(dir)
    .then(files => files.filter(isDirname))
    .then(
      unitDirs => Promise.all(
        unitDirs.map(unitDir => unit(path.join(dirOrPath, unitDir), opts)),
      )
        .then(units => units.reduce(
          (memo, item, idx) => ({
            ...memo,
            [unitDirs[idx]]: item,
          }),
          {},
        )),
    );
};
