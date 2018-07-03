#! /usr/bin/env node
'use strict';

const Path = require('path');
const Async = require('async');
const Minimist = require('minimist');
const Chalk = require('chalk');
const Course = require('./lib/course');
const Syllabus = require('./lib/syllabus');
const Stats = require('./lib/stats');
const Axios = require('axios');
const Common = require('./lib/common');
const util = require('util');

const internals = {};

internals.uniqueObjValues = obj => Object.keys(obj).reduce(
  (memo, key) => (memo.indexOf(obj[key]) === -1) ? [...memo, obj[key]] : memo,
  []
);

internals.parseArgs = args => Object.keys(args).reduce((memo, key) => {
  if (key === '_') {
    memo.paths = args._;
  } else {
    memo.opts[key] = args[key];
  }
  return memo;
}, { paths: [], opts: {} });


// mezcla el syllabus leido en el README.md principal con las unidades leídas
// de las subcarpetas
internals.merge = results => {
  const syllabus = results.course.result.syllabus.reduce((memo, item) => {
    const { href, parts, ...rest } = item;
    memo[href] = rest;
    memo[href].parts = results.syllabus.result[href];
    return memo;
  }, {});

  return {
    result: Object.assign(results.course.result, { syllabus }),
    log: results.course.log.concat(results.syllabus.log)
  };
};


internals.computeUnitsOrder = (merged) => {
  Object.keys(merged.result.syllabus).sort().forEach((unitKey, idx) => {
    merged.result.syllabus[unitKey].order = idx + 1;
  });
  return merged;
};


// reduce arreglo de resultados con todos los cursos (último paso)
internals.reduce = results => results.reduce((memo, item) => {
  if (!item) {
    return memo;
  }
  const { slug, ...rest } = item.result;
  memo.courses[slug] = rest;
  memo.log = memo.log.concat(item.log);
  return memo;
}, { courses: {}, log: [] });

internals.partTypes = {
  read: 'read',
  lectura: 'read',
  leitura: 'read',
  seminar: 'seminar',
  seminario: 'seminar',
  seminário: 'seminar',
  webinar: 'seminar',
  workshop: 'workshop',
  taller: 'workshop',
  quiz: 'quiz',
  practice: 'practice',
  exercício: 'practice',
  'práctica': 'practice', // ?????
  cuestionario: 'other', // ????
  producto: 'practice', // ???? Prácticas sin ejercicios del LMS (libres)
  video: 'read', // ???? este sólo aparece en progreso, no en cursos???
};
internals.validPartTypes = internals.uniqueObjValues(internals.partTypes);

internals.partFormats = {
  guided: 'guided',
  guiado: 'guided',
  'self-paced': 'self-paced',
  individual: 'self-paced',
};
internals.validPartFormats = internals.uniqueObjValues(internals.partFormats);

//Assuming accessToken has repo access to github
internals.processGihubLink = (path, commit, userName, repository, accessToken, cb) => {
  let parsedCourse = {
    course : null,
    syllabus : {}
  };

  console.log("Now parsing : "+`https://api.github.com/repos/${userName}/${repository}/contents//${path}?access_token=${accessToken}`);
  Axios(`https://api.github.com/repos/${userName}/${repository}/contents//${path}?access_token=${accessToken}`).then((response)=>{
    let data = response.data;
    return Promise.all(data.map( element => {
      return Axios(`${element.url}&access_token=${accessToken}`);
    }));
  }).then( responses =>{
    parsedCourse.course = Course(Buffer.from(responses.find(element => {
      if(element.data.length > 0){
        return false;
      }else{
        return element.data.name.toLowerCase() === 'readme.md';
      }
    }).data.content, 'base64'));      
    return Promise.all(responses.map((element)=>{
      if(Array.isArray(element.data)){
        return element.data.map(possibleDir=>{
          if(possibleDir.type == 'dir'){
            return Axios(`${possibleDir.url}&access_token=${accessToken}`);
          }else{
            return null;
          }
        }).filter(aux => {
          return aux != null;
        });
      }else{
        return null;
      }
    })
    .filter(element => element != null)
    .reduce((prev, newElement)=>{
      let ret = [];
      if(Array.isArray(prev)){
        ret = ret.concat(prev);
      }else{
        ret.push(prev);
      }
      if(Array.isArray(newElement)){
        ret = ret.concat(newElement);
      }else{
        ret.push(newElement);
      }
      return ret;
    }));
  }).then(dataFromDirs => {
    return Promise.all(dataFromDirs.map((dirData)=>{     
      if(Array.isArray(dirData.data)){
        const readmeFile = dirData.data.find(dirElement => dirElement.name.toLowerCase() == 'readme.md' );
        if(readmeFile){
          return Axios(`${readmeFile.url}&access_token=${accessToken}`);
        }
      }
      return null;
    }).filter(element => element != null));
  }).then(level2Responses => {
    const nextStepPromises = [];

    level2Responses.forEach(dataFromFile => {
      const fileContent = Buffer.from(dataFromFile.data.content, 'base64');
      let parsedData = Common.parseReadme(fileContent.toString(), {
        tipo: 'type',
        type: 'type',
        formato: 'format',
        format: 'format',
        duración: 'duration',
        duration: 'duration',
        duração: 'duration',
      });

      parsedData.duration = Common.parseDuration(parsedData.duration);
      if (parsedData.duration === null) {
        throw new Error(`Duration for ${parsedData.title} unit not found`);
      }

      if (!internals.partFormats[parsedData.format]) {
        result.log.push(['error', `${parsedData.title} => Unkown part format "${parsedData.format}". Valid formats: "${internals.validPartFormats.join('", "')}"`]);
      } else {
        Object.assign(parsedData, { format: internals.partFormats[parsedData.format] });
      }

      if (!internals.partTypes[parsedData.type]) {
        result.log.push(['error', `${parsedData.title} => Unkown part type "${parsedData.type}". Valid types: "${internals.validPartTypes.join('", "')}"`]);
      } else {
        Object.assign(parsedData, { type: internals.partTypes[parsedData.type] });
      }

      let dirUrl = dataFromFile.data.url; //We need to extract the enclosing folder url
      const urlEnd = dirUrl.indexOf('?');
      dirUrl = dirUrl.substring(0, urlEnd >= 0 ? urlEnd : dirUrl.length);
      const urlPieces = dirUrl.split('/');
      urlPieces.pop();
      dirUrl = urlPieces.join('/');
      dirUrl += `/?access_token=${accessToken}`;
      console.log("Parsed data type > "+parsedData.type);
      switch(parsedData.type){
        case 'practice' : 
          nextStepPromises.push(Axios(dirUrl).then(
            (response)=>{
              return Promise.all(response.data.map(element => {
                return Axios(element.url);
              }));
            }
          ).then((exercisesNextStepElements)=>{
            return Promise.all(exercisesNextStepElements.map((exerciseElement)=>{
              console.log("Excercise element > "+util.inspect(exerciseElement));
            }));
          }).catch((error)=>{
            console.log("#Error > "+error.stack);
          }));
          break;
        case 'quiz' : 

          break;
        default : 
      }

      /* if (result.result.type === 'practice') {
        return internals.parseExercises(path, result, cb);
      }
      else if (result.result.type === 'quiz') {
        result.result.questions = Quiz(result.result.body);
        delete result.result.body;
      } */

      console.log("Step 3 parsed data > "+JSON.stringify(parsedData));
      
    });
  }).then().catch((connectionError)=>{
    console.log("Error > "+connectionError.stack);
  });
}

internals.processPath = (path, cb) => Async.auto({
  // procesa README.md principal del curso
  course: Async.apply(Course, path),
  // lee unidades del syllabus en subcarpetas
  syllabus: Async.apply(Syllabus, Path.dirname(path))
}, (err, results) => {
  if (err) {
    return cb(err);
  }
  cb(null, internals.computeUnitsOrder(internals.merge(results)));
});


internals.severityKeyToColor = {
  error: 'red',
  warn: 'yellow',
  info: 'blue'
};


internals.severityString = str => Chalk[internals.severityKeyToColor[str]](str);


internals.printLog = ({ courses, log }) => {
  log.forEach(item => console.log(
    `${internals.severityString(item[0])}: ${Chalk.grey(item[1])}`
  ));
  internals.printStats(courses);
  process.exit(log.filter(log => log[0] === 'error').length ? 1 : 0);
};


internals.printStats = courses => {
  Object.keys(courses).forEach(courseKey => {
    const course = courses[courseKey];
    const unitKeys = Object.keys(course.syllabus);
    console.log(`---\n\n# ${course.title} (${courseKey})\n`);
    console.log(`Track: ${course.track}`);
    console.log(`Locale: ${course.locale}`);
    console.log(`Duration: ${course.stats.durationString}`);
    console.log(`Units: ${course.stats.unitCount}`);
    console.log(`Parts: ${course.stats.partCount}`);
    console.log(`Exercises: ${course.stats.exerciseCount}\n`);
    unitKeys.forEach((unitKey, unitIdx) => {
      const unit = course.syllabus[unitKey];
      const partKeys = Object.keys(unit.parts || {});
      console.log(`\n## Unit ${unitIdx + 1}: ${unit.title} (${unitKey})\n`);
      console.log(`Duration: ${unit.stats.durationString}`);
      console.log(`Parts: ${unit.stats.partCount}`);
      console.log(`Exercises: ${unit.stats.exerciseCount}\n`);
      partKeys.forEach(partKey => {
        const part = unit.parts[partKey];
        const extercises = (part.exerciseCount) ? `[ ${Object.keys(part.exerciseCount).length} ejercicio(s) ]` : '';
        if (part.type === 'practice') {
          // console.log(part);
        }
        console.log(`| ${partKey} | ${part.type} | ${part.format} | ${part.durationString} | ${part.title} ${extercises}`);
      });
    });
  });
};


internals.applyGlobalOptions = (results, opts) =>
  results.map((result) => {
    if (!['js', 'ux', 'mobile', 'business'].includes(opts.track)) {
      result.log.push(['error', `${result.result.slug} => Unkown track: ${opts.track}`]);
    }
    if (!['es-ES', 'pt-BR', 'en-US'].includes(opts.locale)) {
      result.log.push(['error', `${result.result.slug} => Unkown locale: ${opts.locale}`]);
    }
    return {
      ...result,
      result: {
        ...result.result,
        slug: `${result.result.slug}${opts.suffix ? `-${opts.suffix}` : ''}`,
        track: opts.track,
        locale: opts.locale,
      },
    };
  });


//
// Public API
//
// Crea un objeto JSON con la representación de cada curso dadas las rutas
// (paths) a los README.md de los cursos.
//
module.exports = {
  localStorage : (paths, opts, cb) => Async.map(
    paths.map(path => Path.resolve(process.cwd(), path)),
    internals.processPath,
    (err, results) => {
      if (err) {
        return cb(err);
      }
      cb(null, Stats(internals.reduce(internals.applyGlobalOptions(results, opts))));
    }),
  github : internals.processGihubLink
}

let printResult = (err, result, opts) => {
  if (err) {
    throw err;
  }

  if (opts.validate) {
    return internals.printLog(result);
  }
  console.log(JSON.stringify(result.courses, null, 2));
}

//
// Si el script se ha invocado directamente desde la línea de comando parseamos
// los argumentos e invocamos...
//
if (require.main === module) {
  const { paths, opts } = internals.parseArgs(Minimist(process.argv.slice(2)));

  if (!opts.accessToken) {
    module.exports.localStorage(
      paths,
      opts,
      (err, result) => {
        printResult(err, result, opts);
      }
    );
  } else {
    module.exports.github(paths[0], opts.commit, opts.userName, opts.repository, opts.accessToken, (err, result) => { //Only expecting one path
      printResult(err, result, opts);
    });
  }
}