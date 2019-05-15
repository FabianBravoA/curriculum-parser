const Axios = require('axios');
const unit = require('./unit');


//
// Read syllabus from filesystem (not from main readme).
//
module.exports = (path, opts) => Axios(`https://api.github.com/repos/${opts.userName}/${opts.repository}/contents/${path}?access_token=${opts.accessToken}&ref=${opts.commit}`)
  .then(response => response.data.filter(file => file.type === 'dir'))
  .then(
    unitDirs => Promise.all(
      unitDirs.map(unitDir => unit(unitDir.path, opts)),
    )
      .then(units => units.reduce(
        (memo, item, idx) => ({
          ...memo,
          [unitDirs[idx].name]: item,
        }),
        {},
      )),
  );
