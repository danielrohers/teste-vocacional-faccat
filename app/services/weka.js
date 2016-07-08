// modules
const async = require('async');
const fs = require('fs');
const _ = require('lodash');
const brain = require('brain');
const exec = require('child_process').exec;

// models
const AnswerModel = require('../models/answer');
const CourseModel = require('../models/course');
const QuestionModel = require('../models/question');

// private
const _fileTraining = './data-training.arff';
const _fileTest = './data-test.arff';

const _existFile = (filename) => fs.existsSync(filename)

const _deleteFile = (filename, cb) => {
    if (!_existFile(filename)) return cb();
    fs.unlink(filename, cb);
};

const _append = (filename, text, cb) => {
    fs.appendFile(filename, `${text}\n`, cb);
};

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
            _append(filename, `\n@ATTRIBUTE class {${ courses.map(course => course._id).join() }}\n`, cb);
        })
        .catch(cb)
};

const _addData = (filename, answers, cb) => {
    _append(filename, '@DATA');
    if (!Array.isArray(answers)) answers = [answers];
    let test = /test/.test(filename);
    async.each(answers, (answer, cb) => {
        var values = [];
        if (test) values = _.values(answer);
        else answer.input.forEach(input => values.push(input.option) );
        values.push(test ? '?' : answer.output._id);
        _append(filename, values.join(), cb);
    }, cb);
};

const _createData = (filename, answers, cb) => {
    async.series([
        async.apply(_deleteFile, filename),
        async.apply(_addRelation, filename),
        async.apply(_addAttributes, filename),
        async.apply(_addClass, filename),
        async.apply(_addData, filename, answers)
    ], cb);
};

const _getAnswers = () => {
    return AnswerModel.find({}).populate('output');
};

const _createDataTraining = cb => {
    _getAnswers()
        .then(answers => _createData(_fileTraining, answers, cb))
        .catch(cb);
};

const _clean = array => array.filter(value => !!value);

// public
module.exports = {

    train : _createDataTraining,

    run : (input, cb) => {
        async.parallel([
            cb => {
                if (_existFile(_fileTraining)) return cb();
                _createDataTraining(cb);
            },
            async.apply(_createData, _fileTest, input)
        ], err => {
            if (err) return cb(err);

            let options = {
              'classifier': 'weka.classifiers.functions.MultilayerPerceptron',
              'params'    : ''
            };

            let command = `java -classpath weka.jar ${options.classifier} ${options.params} -t ${_fileTraining} -T ${_fileTest} -p 0 -classifications weka.classifiers.evaluation.output.prediction.CSV`;

            exec(command, (err, stdout, stderr) => {
                if(err) return cb(err);
                if (stderr) return cb(stderr);
                try {
                    console.log("stdout: ", stdout);
                    let output = _clean(_clean(stdout.split('\n')).slice(2)[0].split(',')).slice(2);

                    let result = {
                        course: output[0].replace(/.*:/, ''),
                        value: output[1]
                    };

                    CourseModel
                        .findOne({ _id : result.course })
                        .select('name')
                        .then(course => {
                            result.course = course.name;
                            cb(null, result);
                        })
                        .catch(cb);
                } catch (err) {
                    cb(err);
                }
            });
        });
    }

};
