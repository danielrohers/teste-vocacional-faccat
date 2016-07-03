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
const net = new brain.NeuralNetwork();

const _filename = 'data.arff';

const _deleteFile = cb => {
    if (!fs.existsSync(_filename)) return cb();
    fs.unlink(_filename, cb);
};

const _append = (text, cb) => {
    fs.appendFile(_filename, `${text}\n`, cb);
};

const _err = err => console.log('ERR: ', err);

const _addRelation = cb => _append('@RELATION faccat\n', cb);

const _addAttributes = cb => {
    QuestionModel
        .find({})
        .then(questions => {
            questions.forEach(question => {
                _append(`@ATTRIBUTE ${question._id} NUMERIC`);
            });
            cb();
        })
        .catch(cb);
};

const _addClass = cb => {
    CourseModel
        .find({})
        .then(courses => {
            _append(`\n@ATTRIBUTE class {${ courses.map(course => slug(course.name)).join() }}\n`, cb);
        })
        .catch(cb)
};

const _addData = cb => {
    AnswerModel
        .find({})
        .populate('output')
        .then(answers => {
            _append('@DATA')
            answers.forEach(answer => {
                var values = [];
                answer.input.forEach(input => values.push(input.option) );
                values.push(slug(answer.output.name));
                _append(values.join());
            });
            cb();
        })
        .catch(cb);
};

const _init = () => {
    async.series([
        _deleteFile,
        _addRelation,
        _addAttributes,
        _addClass,
        _addData
    ], (err) => {
        if (err) console.log('ERR: ', err);
        console.log('DONE');
    });
};

_init();
