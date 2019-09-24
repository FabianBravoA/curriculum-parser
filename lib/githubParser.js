const axios = require('axios');
const util = require('util');
const Common = require('./common');
const Course = require('./course');
const { partFormats, partTypes } = require('./part');

const processGithubLink = (path, commit, userName, repository, accessToken) => {
  const parsedCourse = {
    course: null,
    syllabus: {},
  };

  console.log(`Parsing https://api.github.com/repos/${userName}/${repository}/contents/${path}?access_token=${accessToken}`);
  axios(`https://api.github.com/repos/${userName}/${repository}/contents//${path}?access_token=${accessToken}`)
    .then(({ data }) => Promise.all(data.map(element => axios(`${element.url}&access_token=${accessToken}`))))
    .then((responses) => {
      parsedCourse.course = Course(Buffer.from(responses.find((element) => {
        if (element.data.length > 0) {
          return false;
        }
        return element.data.name.toLowerCase() === 'readme.md';
      }).data.content, 'base64'));

      return Promise.all(responses.map((element) => {
        if (Array.isArray(element.data)) {
          return element.data
            .map((possibleDir) => {
              if (possibleDir.type === 'dir') {
                return axios(`${possibleDir.url}&access_token=${accessToken}`);
              }

              return null;
            })
            .filter(aux => aux != null);
        }

        return null;
      })
        .filter(element => element != null)
        .reduce((prev, newElement) => {
          let ret = [];
          if (Array.isArray(prev)) {
            ret = ret.concat(prev);
          } else {
            ret.push(prev);
          }
          if (Array.isArray(newElement)) {
            ret = ret.concat(newElement);
          } else {
            ret.push(newElement);
          }
          return ret;
        }));
    })
    .then(dataFromDirs => Promise.all(
      dataFromDirs
        .map((dirData) => {
          if (Array.isArray(dirData.data)) {
            const readmeFile = dirData.data.find(dirElement => dirElement.name.toLowerCase() === 'readme.md');
            if (readmeFile) {
              return axios(`${readmeFile.url}&access_token=${accessToken}`);
            }
          }
          return null;
        })
        .filter(element => element != null),
    ))
    .then((level2Responses) => {
      const nextStepPromises = [];
      level2Responses.forEach((dataFromFile) => {
        const fileContent = Buffer.from(dataFromFile.data.content, 'base64');
        const parsedData = Common.parseReadme(fileContent.toString(), {
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

        const result = {};
        const validPartFormats = Common.uniqueObjValues(partFormats);
        if (!partFormats[parsedData.format]) {
          result.log.push(['error', `${parsedData.title} => Unkown part format "${parsedData.format}". Valid formats: "${validPartFormats.join('", "')}"`]);
        } else {
          Object.assign(parsedData, { format: partFormats[parsedData.format] });
        }

        const validPartTypes = Common.uniqueObjValues(partTypes);
        if (!partTypes[parsedData.type]) {
          result.log.push(['error', `${parsedData.title} => Unkown part type "${parsedData.type}". Valid types: "${validPartTypes.join('", "')}"`]);
        } else {
          Object.assign(parsedData, { type: partTypes[parsedData.type] });
        }

        let dirUrl = dataFromFile.data.url; // We need to extract the enclosing folder url
        const urlEnd = dirUrl.indexOf('?');
        dirUrl = dirUrl.substring(0, urlEnd >= 0 ? urlEnd : dirUrl.length);
        const urlPieces = dirUrl.split('/');
        urlPieces.pop();
        dirUrl = urlPieces.join('/');
        dirUrl += `/?access_token=${accessToken}`;
        console.log(`Parsed data type > ${parsedData.type}`);
        switch (parsedData.type) {
          case 'practice':
            nextStepPromises.push(
              axios(dirUrl)
                .then(response => Promise.all(response.data.map(element => axios(element.url))))
                .then(exercisesNextStepElements => Promise.all(
                  exercisesNextStepElements.map((exerciseElement) => {
                    console.log(`Excercise element > ${util.inspect(exerciseElement)}`);
                    return exerciseElement;
                  }),
                ))
                .catch((error) => {
                  console.log(`#Error > ${error.stack}`);
                }),
            );
            break;
          case 'quiz':
            break;
          default:
        }

        console.log(`Step 3 parsed data > ${JSON.stringify(parsedData)}`);
      });
    })
    .catch((connectionError) => {
      console.log(`Error > ${connectionError.stack}`);
    });
};

module.exports = processGithubLink;
