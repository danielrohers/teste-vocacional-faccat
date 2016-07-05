'use strict';

// modules
const _ = require('lodash');
const async = require('async');
const brain = require('brain');

// models
const AnswerModel = require('../models/answer');
const QuestionModel = require('../models/question');
const CourseModel = require('../models/course');

const _train = body => {
    return new Promise((resolve, reject) => {
        const net = new brain.NeuralNetwork();
        AnswerModel
            .find({})
            .populate('output')
            .then(answers => {
                try {
                    let inputs = [];
                    answers.forEach(answer => {
                        let data = { input : {}, output: {} };
                        answer.input.forEach(input => data['input'][input.question] = input.option );
                        data['output'][answer.output.name] = 0;
                        inputs.push(data);
                    });
                    net.train(inputs);
                    let data = {};
                    for (let question in body) data[question] = body[question];
                    let result = [];
                    _.forEach(net.run(data), (value, course) => result.push({ course: course, value: value }) );
                    resolve(_.orderBy(result, 'value', 'desc'));
                } catch (err) {
                    reject(err);
                }
            })
            .catch(reject);
    });
};

const _getQuestions = () => {
    return new Promise((resolve, reject) => {
        async.parallel({
            courses : cb => CourseModel.find({}).sort('name').exec(cb),
            questions : cb => QuestionModel.find({}, cb)
        }, (err, result) => {
            if (err) return reject(err);
            resolve({
                courses: result.courses,
                questions: result.questions
            });
        });
    });
};

const _responseTrain = (req, res, result) => {
    _.take(result, 3).forEach(data => req.flash('info', data.course));
    res.render('question');
};

// public
module.exports = {

    render_index : (req, res) => {
        res.render('index');
    },

    render_student : (req, res, next) => {
        _getQuestions()
            .then(data => {
                data.isStudent = true;
                data.title = 'Estudante Faccat?';
                res.render('question', data);
            })
            .catch(next);
    },

    render_find : (req, res, next) => {
        _getQuestions()
            .then(data => {
                data.isStudent = false;
                data.title = 'Não estudante?';
                res.render('question', data);
            })
            .catch(next);
    },

    create : (req, res, next) => {
        let answer = new AnswerModel();
        answer.output = req.body.course;
        if (!!req.body.other_course && req.body.other_course != 'false') answer.output = req.body.other_course;
        delete req.body.course;
        delete req.body.other_course;

        answer.input = [];
        for (let question in req.body) {
            answer.input.push({
                question: question,
                option: req.body[question]
            });
        }

        answer.save(err => {
            if (err) return next(err);
            _train(req.body)
                .then(result => _responseTrain(req, res, result))
                .catch(next)
        })
    },

    find : (req, res, next) => {
        _train(req.body)
            .then(result => _responseTrain(req, res, result))
            .catch(next)
    }

};
