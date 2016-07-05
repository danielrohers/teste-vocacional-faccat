'use strict';

require('./config/mongoose');

const AnswerModel = require('./app/models/answer');
const CourseModel = require('./app/models/course');
const QuestionModel = require('./app/models/question');

const async = require('async');
const fs = require('fs');
const _ = require('lodash');
const brain = require('brain');
const slug = require('slug');
const exec = require('child_process').exec;

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
        var values = [];
        answer.input.forEach(input => values.push(input.option) );
        values.push(slug(answer.output.name));
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
            _createData('./data-training.arff', answers)
                .then(cb)
                .catch(cb)
        })
        .catch(cb);
};

const _createDataTest = cb => {
    _getAnswers()
        .then(answers => {
            let data = _.take(_.shuffle(answers), 15);
            _createData('./data-test.arff', data)
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

        var options = {
          'classifier': 'weka.classifiers.functions.MultilayerPerceptron',
          'params'    : ''
        };

        let command = `java -classpath weka.jar ${options.classifier} ${options.params} -t data-training.arff -T data-test.arff -no-cv -v -p 0`;

        exec(command, (err, stdout, stderr) => {
            if(err) return console.log('ERR: ', err);

            console.log('stdout: ', stdout);

            // _clean(stdout.split('\n')).slice(2).forEach(value => {
            //     console.log('value: ', _clean(value.split(' ')).slice(2));
            // });
        });
    });
};

_init();
