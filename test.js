require('./config/mongoose');

const AnswerModel = require('./app/models/answer');
const CourseModel = require('./app/models/course');
const QuestionModel = require('./app/models/question');

const async = require('async');
const fs = require('fs');
const _ = require('lodash');
const brain = require('brain');
const exec = require('child_process').exec;
const slug = require('slug');

const _fileTraining = './training.arff';
const _fileTest = './test.arff';

const _deleteFile = (filename, cb) => {
    if (!fs.existsSync(filename)) return cb();
    fs.unlink(filename, cb);
};

const _append = (filename, text, cb) => {
    fs.appendFile(filename, `${text}\n`, cb);
};

const _err = err => console.log('ERR: ', err);

const _addRelation = (filename, cb) => _append(filename, '@RELATION faccat\n', cb);

const _addAttributes = (filename, cb) => {
    QuestionModel
        .find({})
        .then(questions => {
            async.eachSeries(questions, (question, cb) => {
                _append(filename, `@ATTRIBUTE ${question._id} NUMERIC`, cb);
            }, cb);
        })
        .catch(cb);
};

const _addClass = (filename, cb) => {
    CourseModel
        .find({})
        .then(courses => {
            _append(filename, `\n@ATTRIBUTE class {${ courses.map(course => slug(course.name)).join() }}\n`, cb);
        })
        .catch(cb)
};

const _addData = (filename, answers, cb) => {
    _append(filename, '@DATA')
    answers.forEach(answer => {
        let values = [];
        answer.input.forEach(input => values.push(input.option) );
        values.push(slug(answer.output.name));
        // values.push(/test/.test(filename) ? '?' : slug(answer.output.name));
        _append(filename, values.join());
    });
    cb();
};

const _createData = (filename, answers, cb) => {
    return new Promise((resolve, reject) => {
        async.series([
            async.apply(_deleteFile, filename),
            async.apply(_addRelation, filename),
            async.apply(_addAttributes, filename),
            async.apply(_addClass, filename),
            async.apply(_addData, filename, answers)
        ], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

const _getAnswers = () => {
    return AnswerModel.find({}).populate('output');
};

const _createDataTraining = cb => {
    _getAnswers()
        .then(answers => {
            _createData(_fileTraining, answers)
                .then(cb)
                .catch(cb)
        })
        .catch(cb);
};

const _createDataTest = cb => {
    _getAnswers()
        .then(answers => {
            let data = _.take(_.shuffle(answers), 15);
            _createData(_fileTest, data)
                .then(cb)
                .catch(cb)
        })
        .catch(cb);
};

const _clean = array => array.filter(value => !!value);

const _init = () => {
    async.series([
        async.apply(_createDataTraining),
        async.apply(_createDataTest)
    ], (err) => {
        if (err) console.log('ERR: ', err);

        console.log('data files created');

        let options = {
          'classifier': 'weka.classifiers.functions.MultilayerPerceptron',
          'params'    : ''
        };

        let command = `java -classpath weka.jar ${options.classifier} ${options.params} -t ${_fileTraining} -T ${_fileTest} -p 0`;

        exec(command, (err, stdout, stderr) => {
            if(err) return console.log('ERR: ', err);

            console.log('stdout: ', stdout);
        });
    });
};

_init();
