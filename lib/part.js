const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const axios = require('axios');
const common = require('./common');
const exercise = require('./exercise');
const quiz = require('./quiz');


exports.partTypes = {
  read: 'read',
  lectura: 'read',
  leitura: 'read',
  seminar: 'seminar',
  seminario: 'seminar',
  seminário: 'seminar',
  webinar: 'seminar',
  oficina: 'workshop',
  workshop: 'workshop',
  taller: 'workshop',
  quiz: 'quiz',
  practice: 'practice',
  exercício: 'practice',
  práctica: 'practice', // ?????
  cuestionario: 'other', // ????
  producto: 'practice', // ???? Prácticas sin ejercicios del LMS (libres)
  video: 'read', // ???? este sólo aparece en progreso, no en cursos???
};

exports.partFormats = {
  guided: 'guided',
  guiado: 'guided',
  'self-paced': 'self-paced',
  individual: 'self-paced',
};


module.exports = async (dirOrPath, opts = {}) => {
  const readmeFileName = common.getReadmeFileName(opts.locale);

  if (opts.token) {
    const { repo, token, branch } = opts;
    const [username, repository] = repo.split('/');
    const readmeUrl = `https://api.github.com/repos/${username}/${repository}/contents/${encodeURIComponent(dirOrPath)}/${readmeFileName}?access_token=${token}&ref=${branch}`;
    try {
      const readmeResponse = await axios(readmeUrl);
      const readme = Buffer.from(readmeResponse.data.content, 'base64').toString();
      const parsedReadme = common.parseReadme(readme, {
        tipo: 'type',
        type: 'type',
        formato: 'format',
        format: 'format',
        duración: 'duration',
        duration: 'duration',
        duração: 'duration',
      });
      Object.assign(parsedReadme, {
        duration: common.parseDuration(parsedReadme.duration),
        format: exports.partFormats[parsedReadme.format],
        type: exports.partTypes[parsedReadme.type],
      });

      if (parsedReadme.duration === null) {
        throw Object.assign(new Error('Could not parse part duration'), {
          path: dirOrPath,
          type: 'part',
        });
      }

      // TODO: Support parsing of `practice` type parts

      if (parsedReadme.type === 'quiz') {
        return Object.keys(parsedReadme).reduce(
          (memo, key) => (
            (key === 'body')
              ? memo
              : { ...memo, [key]: parsedReadme[key] }
          ),
          {
            questions: quiz(parsedReadme.body),
          },
        );
      }

      return parsedReadme;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        throw Object.assign(new Error('Part is missing README.md'), {
          path: `${dirOrPath}/${readmeFileName}`,
          type: 'part',
        });
      }
    }
  }

  const dir = path.resolve(dirOrPath);
  return promisify(fs.readdir)(dir)
    .then((files) => {
      if (files.indexOf(readmeFileName) === -1) {
        throw Object.assign(new Error('Part is missing README.md'), {
          path: dirOrPath,
          type: 'part',
        });
      }

      return promisify(fs.readFile)(path.join(dirOrPath, readmeFileName), 'utf8')
        .then(readme => [readme, files]);
    })
    .then(([readme, files]) => {
      const parsedReadme = common.parseReadme(readme, {
        tipo: 'type',
        type: 'type',
        formato: 'format',
        format: 'format',
        duración: 'duration',
        duration: 'duration',
        duração: 'duration',
      });

      Object.assign(parsedReadme, {
        duration: common.parseDuration(parsedReadme.duration),
        format: exports.partFormats[parsedReadme.format],
        type: exports.partTypes[parsedReadme.type],
      });

      if (parsedReadme.duration === null) {
        throw Object.assign(new Error('Could not parse part duration'), {
          path: dirOrPath,
          type: 'part',
        });
      }

      if (parsedReadme.type === 'practice') {
        return Promise.all(
          files
            .filter(common.isDirname)
            .map(file => exercise(path.join(dirOrPath, file), opts)),
        )
          .then(all => all.reduce(
            (memo, { slug, ...item }) => ({ ...memo, [slug]: item }),
            {},
          ))
          .then(exercises => (
            (Object.keys(exercises).length > 0)
              ? { ...parsedReadme, exercises }
              : parsedReadme
          ));
      }

      if (parsedReadme.type === 'quiz') {
        return Object.keys(parsedReadme).reduce(
          (memo, key) => (
            (key === 'body')
              ? memo
              : { ...memo, [key]: parsedReadme[key] }
          ),
          {
            questions: quiz(parsedReadme.body),
          },
        );
      }

      return parsedReadme;
    });
};
