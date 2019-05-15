const Axios = require('axios');
const { parseReadme, parseDirname } = require('./common');


const reduceFileObjects = (path, json) => json.reduce(
  (memo, item) => ({
    ...memo,
    [Buffer.from(item.path.replace(path, '').slice(1)).toString('base64')]: (
      (item.content)
        ? item.content
        : reduceFileObjects(item.path, item.children)
    ),
  }),
  {},
);


const dirToJSON = (path, opts) => Axios(`https://api.github.com/repos/${opts.userName}/${opts.repository}/contents/${path}?access_token=${opts.accessToken}&ref=${opts.commit}`)
  .then(response => Promise.all(
    response.data.map(
      file => (file.type === 'dir'
        ? dirToJSON(file.path, opts)
          .then(children => ({ path: file.path, children }))
        : Axios(`https://api.github.com/repos/${opts.userName}/${opts.repository}/contents/${file.path}?access_token=${opts.accessToken}&ref=${opts.commit}`)
          .then(fileResponse => (
            {
              path: fileResponse.data.path,
              content: Buffer.from(fileResponse.data.content, 'base64').toString(),
            }
          ))
      ),
    ),
  ));

module.exports = (path, opts) => {
  const { slug } = opts;

  return dirToJSON(path, opts)
    .then((json) => {
      const filesObj = reduceFileObjects(path, json);
      const readmeKey = Buffer.from('README.md').toString('base64');
      const { [readmeKey]: readme, ...files } = filesObj;
      if (!readme) {
        throw Object.assign(new Error('Empty or missing exercise README.md'), {
          path,
          type: 'exercise',
        });
      }

      const parsedReadme = parseReadme(readme, {
        environment: 'env',
        entorno: 'env',
        env: 'env',
      });

      return { slug, ...parsedReadme, files };
    });
};
