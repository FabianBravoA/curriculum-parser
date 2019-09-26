const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const axios = require('axios');
const { isDirname } = require('./common');
const part = require('./part');


module.exports = async (dirOrPath, opts = {}) => {
  if (opts.token) {
    const { repo, token, branch } = opts;
    const [username, repository] = repo.split('/');
    const url = `https://api.github.com/repos/${username}/${repository}/contents/${dirOrPath}?access_token=${token}&ref=${branch}`;
    const response = await axios(url);
    const partDirs = response.data.filter(file => file.type === 'dir');
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
