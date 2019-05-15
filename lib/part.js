const Axios = require('axios');
const common = require('./common');
const exercise = require('./exercise');
const quiz = require('./quiz');


const partTypes = {
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


const partFormats = {
  guided: 'guided',
  guiado: 'guided',
  'self-paced': 'self-paced',
  individual: 'self-paced',
};


module.exports = (path, opts) => Axios(`https://api.github.com/repos/${opts.userName}/${opts.repository}/contents/${path}?access_token=${opts.accessToken}&ref=${opts.commit}`)
  .then((response) => {
    if (!response.data.find(file => file.name === 'README.md')) {
      throw Object.assign(new Error('Part is missing README.md'), {
        path,
        type: 'part',
      });
    }

    return Axios(`https://api.github.com/repos/${opts.userName}/${opts.repository}/contents/${path}/README.md?access_token=${opts.accessToken}&ref=${opts.commit}`)
      .then(readmeResponse => Buffer.from(readmeResponse.data.content, 'base64').toString())
      .then(readme => [readme, response.data]);
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
      format: partFormats[parsedReadme.format],
      type: partTypes[parsedReadme.type],
    });

    if (parsedReadme.duration === null) {
      throw Object.assign(new Error('Could not parse part duration'), {
        path,
        type: 'part',
      });
    }

    if (parsedReadme.type === 'practice') {
      return Promise.all(
        files
          .filter(file => file.type === 'dir')
          .map(file => exercise(file.path, opts)),
      )
        .then(all => all.reduce(
          (memo, { slug, ...item }) => ({ ...memo, [slug]: item }),
          {},
        ))
        .then(exercises => ({
          ...parsedReadme,
          exercises,
        }));
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
