const Axios = require('axios');
const part = require('./part');


module.exports = (path, opts) => Axios(`https://api.github.com/repos/${opts.userName}/${opts.repository}/contents/${path}?access_token=${opts.accessToken}&ref=${opts.commit}`)
  .then(response => response.data.filter(file => file.type === 'dir'))
  .then(
    partDirs => Promise.all(
      partDirs.map(partDir => part(partDir.path, opts)),
    )
      .then(parts => parts.reduce(
        (memo, item, idx) => ({
          ...memo,
          [partDirs[idx]]: item,
        }),
        {},
      )),
  );
