const Axios = require('axios');
const { parseReadme } = require('./common');


const reduceFileObjects = (path, json) => json.reduce(
  (memo, item) => ({
    ...memo,
    [Buffer.from(item.path.replace(dir, '').slice(1)).toString('base64')]: (
      (item.content)
        ? item.content
        : reduceFileObjects(item.path, item.children)
    ),
  }),
  {},
);


const dirToJSON = (dir, opts) => Axios(`https://api.github.com/repos/${opts.userName}/${opts.repository}/contents/${path}?access_token=${opts.accessToken}&ref=${opts.commit}`)
  .then(files => Promise.all(
    files.map(
      file => stat(path.join(dir, file))
        .then(statResult => (
          (statResult.isDirectory())
            ? dirToJSON(path.join(dir, file))
              .then(children => ({ path: path.join(dir, file), children }))
            : readFile(path.join(dir, file), 'utf8')
              .then(content => ({ path: path.join(dir, file), content }))
        )),
    ),
  ));


module.exports = (path, opts) => {
  const slug = path.basename(path);

  return dirToJSON(path, opts)
    .then((json) => {
      const filesObj = reduceFileObjects(dir, json);
      const readmeKey = Buffer.from('README.md').toString('base64');
      const { [readmeKey]: readme, ...files } = filesObj;

      if (!readme) {
        throw Object.assign(new Error('Empty or missing exercise README.md'), {
          path: dir,
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
